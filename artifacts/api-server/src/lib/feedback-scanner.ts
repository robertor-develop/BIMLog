import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

const HEX_64 = /^[a-f0-9]{64}$/;
const MEDIA_TYPE = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$/i;
const THREAT_NAME = /^[A-Za-z0-9][A-Za-z0-9._:@()+-]{0,199}$/;
const ALLOWED_ENVIRONMENT_KEYS = new Set([
  "BIMLOG_FEEDBACK_SCANNER",
  "BIMLOG_FEEDBACK_SCANNER_EXECUTABLE",
  "BIMLOG_FEEDBACK_SCANNER_EXECUTABLE_SHA256",
  "BIMLOG_FEEDBACK_SCANNER_EXECUTABLE_VERSION",
  "BIMLOG_FEEDBACK_SCANNER_TIMEOUT_MS",
  "BIMLOG_FEEDBACK_SCANNER_VERSION_TIMEOUT_MS",
  "BIMLOG_FEEDBACK_SCANNER_MAX_OUTPUT_BYTES",
]);

export type FeedbackScannerErrorCode =
  | "FEEDBACK_SCANNER_CONFIGURATION_INVALID"
  | "FEEDBACK_SCANNER_EXECUTABLE_INVALID"
  | "FEEDBACK_SCANNER_EXECUTABLE_IDENTITY_MISMATCH"
  | "FEEDBACK_SCANNER_VERSION_MISMATCH"
  | "FEEDBACK_SCANNER_INPUT_MISMATCH"
  | "FEEDBACK_SCANNER_ABORTED"
  | "FEEDBACK_SCANNER_TIMEOUT"
  | "FEEDBACK_SCANNER_OUTPUT_LIMIT"
  | "FEEDBACK_SCANNER_EXECUTION_FAILED"
  | "FEEDBACK_SCANNER_VERDICT_INVALID";

export class FeedbackScannerError extends Error {
  constructor(readonly code: FeedbackScannerErrorCode, message: string) {
    super(message);
    this.name = "FeedbackScannerError";
  }
}

export type FeedbackScannerBinding = Readonly<{
  adapter: "clamav-cli";
  executable: string;
  executableSha256: string;
  executableVersion: string;
  timeoutMs: number;
  versionTimeoutMs: number;
  maxOutputBytes: number;
}>;

export type FeedbackScanExpected = Readonly<{
  sha256: string;
  byteCount: number;
  mediaType: string;
}>;

export type FeedbackScanReceipt = Readonly<{
  verdict: "clean" | "infected";
  scannerAdapter: "clamav-cli";
  scannerVersion: string;
  executableSha256: string;
  inspectedAt: string;
  mediaType: string;
  byteCount: number;
  sha256: string;
  threatName: string | null;
}>;

export type FeedbackScannerHealth = Readonly<{
  healthy: true;
  scannerAdapter: "clamav-cli";
  scannerVersion: string;
  executableSha256: string;
}>;

type CommandTermination = "none" | "timeout" | "aborted" | "output-limit";
type CommandResult = Readonly<{ code: number | null; stdout: string; stderr: string; termination: CommandTermination }>;

function invalid(message: string): never {
  throw new FeedbackScannerError("FEEDBACK_SCANNER_CONFIGURATION_INVALID", message);
}

function boundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number, label: string) {
  const result = value === undefined || value === "" ? fallback : Number(value);
  if (!Number.isSafeInteger(result) || result < minimum || result > maximum) invalid(`${label} is outside its governed bound`);
  return result;
}

export function parseFeedbackScannerEnvironment(environment: NodeJS.ProcessEnv = process.env): FeedbackScannerBinding {
  const unknown = Object.keys(environment).filter(key => (key === "BIMLOG_FEEDBACK_SCANNER" || key.startsWith("BIMLOG_FEEDBACK_SCANNER_")) && !ALLOWED_ENVIRONMENT_KEYS.has(key));
  if (unknown.length) invalid("Unknown feedback scanner configuration is present");
  if (environment.BIMLOG_FEEDBACK_SCANNER !== "clamav-cli") invalid("Production feedback scanner must be clamav-cli");
  const executable = environment.BIMLOG_FEEDBACK_SCANNER_EXECUTABLE ?? "";
  const executableSha256 = (environment.BIMLOG_FEEDBACK_SCANNER_EXECUTABLE_SHA256 ?? "").toLowerCase();
  const executableVersion = environment.BIMLOG_FEEDBACK_SCANNER_EXECUTABLE_VERSION ?? "";
  if (!path.isAbsolute(executable) || !HEX_64.test(executableSha256) || !executableVersion || executableVersion.length > 240 || /[\r\n\0]/.test(executableVersion))
    invalid("Exact absolute executable, SHA-256, and version authority are required");
  return Object.freeze({
    adapter: "clamav-cli" as const,
    executable: path.resolve(executable),
    executableSha256,
    executableVersion,
    timeoutMs: boundedInteger(environment.BIMLOG_FEEDBACK_SCANNER_TIMEOUT_MS, 15_000, 1_000, 120_000, "Scanner timeout"),
    versionTimeoutMs: boundedInteger(environment.BIMLOG_FEEDBACK_SCANNER_VERSION_TIMEOUT_MS, 5_000, 500, 30_000, "Scanner version timeout"),
    maxOutputBytes: boundedInteger(environment.BIMLOG_FEEDBACK_SCANNER_MAX_OUTPUT_BYTES, 16_384, 256, 1_048_576, "Scanner output limit"),
  });
}

async function executableSha256(executable: string): Promise<string> {
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(executable);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("not a regular file");
    if (fs.realpathSync(executable) !== path.resolve(executable)) throw new Error("indirect executable path");
  } catch {
    throw new FeedbackScannerError("FEEDBACK_SCANNER_EXECUTABLE_INVALID", "Scanner executable is not a direct regular file");
  }
  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = fs.createReadStream(executable);
    stream.on("data", chunk => hash.update(chunk));
    stream.once("error", reject);
    stream.once("end", resolve);
  });
  return hash.digest("hex");
}

function scannerEnvironment(): NodeJS.ProcessEnv {
  // Replit exposes declared Nix packages through its governed runtime PATH.
  // The committed launcher still pins the exact content-addressed store path
  // and version before forwarding a fixed scanner operation.
  const keys = ["SystemRoot", "WINDIR", "LANG", "LC_ALL", "TZ", "PATH"];
  return Object.fromEntries(keys.flatMap(key => process.env[key] ? [[key, process.env[key]]] : []));
}

async function terminate(child: ChildProcessWithoutNullStreams) {
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
}

async function runBoundedCommand(input: {
  executable: string;
  argv: readonly string[];
  stdin: Buffer | null;
  timeoutMs: number;
  maxOutputBytes: number;
  signal?: AbortSignal;
}): Promise<CommandResult> {
  if (input.signal?.aborted) throw new FeedbackScannerError("FEEDBACK_SCANNER_ABORTED", "Feedback scan was aborted");
  return await new Promise<CommandResult>((resolve, reject) => {
    let child: ChildProcessWithoutNullStreams;
    try {
      child = spawn(input.executable, [...input.argv], { shell: false, windowsHide: true, stdio: ["pipe", "pipe", "pipe"], env: scannerEnvironment() });
    } catch {
      reject(new FeedbackScannerError("FEEDBACK_SCANNER_EXECUTION_FAILED", "Scanner could not be started"));
      return;
    }
    const stdout: Buffer[] = [], stderr: Buffer[] = [];
    let outputBytes = 0, settled = false, termination: CommandTermination = "none";
    const stop = (reason: Exclude<CommandTermination, "none">) => {
      if (termination !== "none") return;
      termination = reason;
      void terminate(child);
    };
    const collect = (target: Buffer[], value: Buffer) => {
      outputBytes += value.byteLength;
      if (outputBytes > input.maxOutputBytes) stop("output-limit");
      else target.push(value);
    };
    child.stdout.on("data", (value: Buffer) => collect(stdout, value));
    child.stderr.on("data", (value: Buffer) => collect(stderr, value));
    const onAbort = () => stop("aborted");
    input.signal?.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => stop("timeout"), input.timeoutMs);
    child.once("error", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      input.signal?.removeEventListener("abort", onAbort);
      reject(new FeedbackScannerError("FEEDBACK_SCANNER_EXECUTION_FAILED", "Scanner process failed"));
    });
    child.once("close", code => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      input.signal?.removeEventListener("abort", onAbort);
      resolve(Object.freeze({ code, stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8"), termination }));
    });
    child.stdin.once("error", error => {
      if ((error as NodeJS.ErrnoException).code !== "EPIPE") stop("aborted");
    });
    if (input.stdin) child.stdin.end(input.stdin);
    else child.stdin.end();
  });
}

function assertCompleted(result: CommandResult) {
  if (result.termination === "timeout") throw new FeedbackScannerError("FEEDBACK_SCANNER_TIMEOUT", "Scanner exceeded its deadline");
  if (result.termination === "aborted") throw new FeedbackScannerError("FEEDBACK_SCANNER_ABORTED", "Feedback scan was aborted");
  if (result.termination === "output-limit") throw new FeedbackScannerError("FEEDBACK_SCANNER_OUTPUT_LIMIT", "Scanner output exceeded its bound");
}

export class GovernedFeedbackScanner {
  private constructor(
    readonly binding: FeedbackScannerBinding,
    private readonly commandPrefix: readonly string[],
    private readonly clock: () => Date,
  ) {}

  static production(binding: FeedbackScannerBinding) {
    return new GovernedFeedbackScanner(binding, Object.freeze([]), () => new Date());
  }

  static proof(binding: FeedbackScannerBinding, commandPrefix: readonly string[], clock: () => Date = () => new Date()) {
    if (process.env.NODE_ENV === "production" || !commandPrefix.length) invalid("Scanner proof harness is unavailable in production");
    return new GovernedFeedbackScanner(binding, Object.freeze([...commandPrefix]), clock);
  }

  private async verifyIdentity() {
    if (await executableSha256(this.binding.executable) !== this.binding.executableSha256)
      throw new FeedbackScannerError("FEEDBACK_SCANNER_EXECUTABLE_IDENTITY_MISMATCH", "Scanner executable SHA-256 differs from authority");
  }

  async verifyStartup(): Promise<FeedbackScannerHealth> {
    await this.verifyIdentity();
    const result = await runBoundedCommand({ executable: this.binding.executable, argv: [...this.commandPrefix, "--version"], stdin: null, timeoutMs: this.binding.versionTimeoutMs, maxOutputBytes: this.binding.maxOutputBytes });
    assertCompleted(result);
    if (result.code !== 0 || result.stderr !== "" || result.stdout.trim() !== this.binding.executableVersion)
      throw new FeedbackScannerError("FEEDBACK_SCANNER_VERSION_MISMATCH", "Scanner executable version differs from authority");
    await this.verifyIdentity();
    return Object.freeze({ healthy: true, scannerAdapter: "clamav-cli", scannerVersion: this.binding.executableVersion, executableSha256: this.binding.executableSha256 });
  }

  async scan(bytes: Buffer, expected: FeedbackScanExpected, options: { signal?: AbortSignal } = {}): Promise<FeedbackScanReceipt> {
    if (!Buffer.isBuffer(bytes) || !Number.isSafeInteger(expected.byteCount) || expected.byteCount < 0 || expected.byteCount !== bytes.byteLength || !HEX_64.test(expected.sha256) || createHash("sha256").update(bytes).digest("hex") !== expected.sha256 || !MEDIA_TYPE.test(expected.mediaType))
      throw new FeedbackScannerError("FEEDBACK_SCANNER_INPUT_MISMATCH", "Scanner input differs from its expected byte, hash, or media binding");
    await this.verifyIdentity();
    const result = await runBoundedCommand({ executable: this.binding.executable, argv: [...this.commandPrefix, "--stdout", "--no-summary", "-"], stdin: bytes, timeoutMs: this.binding.timeoutMs, maxOutputBytes: this.binding.maxOutputBytes, signal: options.signal });
    assertCompleted(result);
    await this.verifyIdentity();
    const output = result.stdout.trim();
    let verdict: FeedbackScanReceipt["verdict"], threatName: string | null = null;
    if (result.code === 0 && result.stderr === "" && output === "stdin: OK") verdict = "clean";
    else {
      const infected = /^stdin: (\S+) FOUND$/.exec(output);
      if (result.code === 1 && result.stderr === "" && infected && THREAT_NAME.test(infected[1])) { verdict = "infected"; threatName = infected[1]; }
      else if (result.code !== 0 && result.code !== 1) throw new FeedbackScannerError("FEEDBACK_SCANNER_EXECUTION_FAILED", "Scanner returned an operational failure");
      else throw new FeedbackScannerError("FEEDBACK_SCANNER_VERDICT_INVALID", "Scanner output was not an exact governed verdict");
    }
    return Object.freeze({ verdict, scannerAdapter: "clamav-cli", scannerVersion: this.binding.executableVersion, executableSha256: this.binding.executableSha256, inspectedAt: this.clock().toISOString(), mediaType: expected.mediaType, byteCount: expected.byteCount, sha256: expected.sha256, threatName });
  }
}

export function createFeedbackScannerFromEnvironment(environment: NodeJS.ProcessEnv = process.env) {
  return GovernedFeedbackScanner.production(parseFeedbackScannerEnvironment(environment));
}

/** Deterministic executable harness for behavior proof; mechanically denied in production. */
export function createFeedbackScannerProofHarness(binding: FeedbackScannerBinding, commandPrefix: readonly string[], clock?: () => Date) {
  return GovernedFeedbackScanner.proof(binding, commandPrefix, clock);
}
