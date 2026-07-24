import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const databaseToolErrorPatterns = [
  /(?:^|\n)\s*(?:error|postgreserror|failed)\b/im,
  /\bseverity\s*[:=]\s*["']?error\b/i,
  /\b(?:sqlstate|code)\s*[:=]\s*["']?[0-9A-Z]{5}\b/i,
];

function cleanTerminalControlCodes(value) {
  return String(value ?? "").replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "");
}

export function databaseToolResultFailed(result) {
  if (result.error || result.signal || result.status !== 0) return true;
  const output = cleanTerminalControlCodes(`${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  return databaseToolErrorPatterns.some((pattern) => pattern.test(output));
}

function connectionIdentity(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.pathname) {
      throw new Error();
    }
    return {
      hostname: url.hostname.toLowerCase(),
      identity: `${url.hostname.toLowerCase()}/${url.pathname
        .replace(/^\/+/, "")
        .toLowerCase()}`,
    };
  } catch {
    throw new Error("Safety refusal: database connection identity is invalid");
  }
}

export function validateTarget(environment = process.env) {
  if (environment.BIMLOG_SCHEMA_TARGET !== "development") {
    throw new Error("Safety refusal: BIMLOG_SCHEMA_TARGET=development is required");
  }
  if (!environment.DATABASE_URL) throw new Error("Safety refusal: DATABASE_URL is required");
  if (!environment.PROD_DATABASE_URL) {
    throw new Error("Safety refusal: PROD_DATABASE_URL is required for identity comparison");
  }
  const development = connectionIdentity(environment.DATABASE_URL);
  const production = connectionIdentity(environment.PROD_DATABASE_URL);
  if (!development.hostname.includes("helium")) {
    throw new Error("Safety refusal: development schema sync is restricted to Replit Helium");
  }
  if (development.identity === production.identity) {
    throw new Error("Safety refusal: development schema sync resolves to production");
  }
}

export function main() {
  validateTarget();
  if (process.argv.includes("--validate-target-only")) {
    console.log("Development database target validation: passed.");
    return 0;
  }

  const sourceGate = spawnSync(
    process.execPath,
    [
      fileURLToPath(new URL("../../../scripts/check-database-safety.mjs", import.meta.url)),
      "--attest-source",
    ],
    { env: process.env, stdio: "inherit" },
  );
  if (sourceGate.status !== 0) return sourceGate.status ?? 1;

  const push = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["exec", "drizzle-kit", "push", "--force", "--config", "./drizzle.config.ts"],
    {
      cwd: new URL("..", import.meta.url),
      env: process.env,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      stdio: ["inherit", "pipe", "pipe"],
    },
  );
  if (push.stdout) process.stdout.write(push.stdout);
  if (push.stderr) process.stderr.write(push.stderr);
  if (databaseToolResultFailed(push)) {
    console.error("Development schema sync refused database-tool error output.");
    return push.status && push.status !== 0 ? push.status : 1;
  }

  const parity = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("./check-schema-parity.mjs", import.meta.url))],
    { env: process.env, stdio: "inherit" },
  );
  return parity.status ?? 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  process.exit(main());
}
