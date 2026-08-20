import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  FeedbackScannerError,
  createFeedbackScannerFromEnvironment,
  createFeedbackScannerProofHarness,
  parseFeedbackScannerEnvironment,
} from "./feedback-scanner.js";

async function fixture() {
  if (process.argv.includes("--version")) { process.stdout.write("ClamAV Fixture 1.0.0\n"); return; }
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  const value = Buffer.concat(chunks).toString("utf8");
  if (value === "timeout") { await new Promise(resolve => setTimeout(resolve, 5_000)); return; }
  if (value === "overflow") { process.stdout.write("x".repeat(8_192)); return; }
  if (value === "infected") { process.stdout.write("stdin: Eicar-Test-Signature FOUND\n"); process.exitCode = 1; return; }
  if (value === "ambiguous") { process.stdout.write("stdin: OK\nstdin: Eicar FOUND\n"); return; }
  process.stdout.write("stdin: OK\n");
}

async function expectCode(code: string, run: () => Promise<unknown>) {
  await assert.rejects(run, (error: unknown) => error instanceof FeedbackScannerError && error.code === code);
}

async function behavior() {
  const executable = process.execPath;
  const executableHash = createHash("sha256").update(fs.readFileSync(executable)).digest("hex");
  const environment: NodeJS.ProcessEnv = {
    BIMLOG_FEEDBACK_SCANNER: "clamav-cli",
    BIMLOG_FEEDBACK_SCANNER_EXECUTABLE: executable,
    BIMLOG_FEEDBACK_SCANNER_EXECUTABLE_SHA256: executableHash,
    BIMLOG_FEEDBACK_SCANNER_EXECUTABLE_VERSION: "ClamAV Fixture 1.0.0",
    BIMLOG_FEEDBACK_SCANNER_TIMEOUT_MS: "1000",
    BIMLOG_FEEDBACK_SCANNER_VERSION_TIMEOUT_MS: "1000",
    BIMLOG_FEEDBACK_SCANNER_MAX_OUTPUT_BYTES: "1024",
  };
  const binding = parseFeedbackScannerEnvironment(environment);
  assert(Object.isFrozen(binding));
  const script = fileURLToPath(import.meta.url);
  const scanner = createFeedbackScannerProofHarness(binding, ["--import", "tsx", script, "--scanner-fixture"], () => new Date("2026-08-20T12:00:00.000Z"));
  assert.deepEqual(await scanner.verifyStartup(), { healthy: true, scannerAdapter: "clamav-cli", scannerVersion: "ClamAV Fixture 1.0.0", executableSha256: executableHash });

  const expected = (bytes: Buffer) => ({ sha256: createHash("sha256").update(bytes).digest("hex"), byteCount: bytes.byteLength, mediaType: "application/octet-stream" });
  const clean = Buffer.from("clean");
  assert.deepEqual(await scanner.scan(clean, expected(clean)), { verdict: "clean", scannerAdapter: "clamav-cli", scannerVersion: "ClamAV Fixture 1.0.0", executableSha256: executableHash, inspectedAt: "2026-08-20T12:00:00.000Z", mediaType: "application/octet-stream", byteCount: 5, sha256: expected(clean).sha256, threatName: null });
  const infected = Buffer.from("infected");
  assert.equal((await scanner.scan(infected, expected(infected))).verdict, "infected");
  assert.equal((await scanner.scan(infected, expected(infected))).threatName, "Eicar-Test-Signature");

  const timeoutEnvironment = { ...environment, BIMLOG_FEEDBACK_SCANNER_TIMEOUT_MS: "1000" };
  const timeoutScanner = createFeedbackScannerProofHarness(parseFeedbackScannerEnvironment(timeoutEnvironment), ["--import", "tsx", script, "--scanner-fixture"]);
  const timeout = Buffer.from("timeout");
  await expectCode("FEEDBACK_SCANNER_TIMEOUT", () => timeoutScanner.scan(timeout, expected(timeout)));
  const overflow = Buffer.from("overflow");
  await expectCode("FEEDBACK_SCANNER_OUTPUT_LIMIT", () => scanner.scan(overflow, expected(overflow)));
  const ambiguous = Buffer.from("ambiguous");
  await expectCode("FEEDBACK_SCANNER_VERDICT_INVALID", () => scanner.scan(ambiguous, expected(ambiguous)));
  await expectCode("FEEDBACK_SCANNER_INPUT_MISMATCH", () => scanner.scan(clean, { ...expected(clean), sha256: "0".repeat(64) }));
  await expectCode("FEEDBACK_SCANNER_INPUT_MISMATCH", () => scanner.scan(clean, { ...expected(clean), byteCount: 6 }));
  await expectCode("FEEDBACK_SCANNER_INPUT_MISMATCH", () => scanner.scan(clean, { ...expected(clean), mediaType: "invalid" }));

  const controller = new AbortController(); controller.abort();
  await expectCode("FEEDBACK_SCANNER_ABORTED", () => scanner.scan(clean, expected(clean), { signal: controller.signal }));
  await expectCode("FEEDBACK_SCANNER_EXECUTABLE_IDENTITY_MISMATCH", () => createFeedbackScannerProofHarness({ ...binding, executableSha256: "0".repeat(64) }, ["--import", "tsx", script, "--scanner-fixture"]).verifyStartup());
  await expectCode("FEEDBACK_SCANNER_VERSION_MISMATCH", () => createFeedbackScannerProofHarness({ ...binding, executableVersion: "ClamAV Fixture 2.0.0" }, ["--import", "tsx", script, "--scanner-fixture"]).verifyStartup());
  assert.throws(() => parseFeedbackScannerEnvironment({ ...environment, BIMLOG_FEEDBACK_SCANNER: "fixture-clean" }), /clamav-cli/);
  assert.throws(() => parseFeedbackScannerEnvironment({ ...environment, BIMLOG_FEEDBACK_SCANNER_UNKNOWN: "stale" }), /Unknown feedback scanner/);
  assert.throws(() => parseFeedbackScannerEnvironment({ ...environment, BIMLOG_FEEDBACK_SCANNER_EXECUTABLE: "relative/clamscan" }), /Exact absolute executable/);

  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try { assert.throws(() => createFeedbackScannerProofHarness(binding, ["fixture"]), /unavailable in production/); }
  finally { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; }
  assert(createFeedbackScannerFromEnvironment(environment));
  console.log(JSON.stringify({ status: "PASS", tests: ["sealed-environment", "exact-executable-identity", "exact-version-health", "clean", "infected", "timeout", "abort", "output-cap", "ambiguous-output-deny", "hash-byte-media-binding", "fixture-production-deny", "invalid-authority"] }));
}

if (process.argv.includes("--scanner-fixture")) await fixture();
else await behavior();
