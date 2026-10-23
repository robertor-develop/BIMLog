import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireApi = createRequire(path.join(root, "artifacts", "api-server", "package.json"));
const { Client } = requireApi("pg");
export const workflowFixtureNames = Object.freeze([
  "delivery_template_test",
  "delivery_runtime_test",
  "economic_allocation_test",
  "bimlog_intake_integration_test",
  "company_pricing_template_test",
  "bimlog_recovery_ga_http_test",
]);

export function validateWorkflowFixture(name, adminUrl) {
  if (!workflowFixtureNames.includes(name)) throw new Error("Workflow fixture name is not approved.");
  const identity = new URL(adminUrl);
  if (!['postgres:', 'postgresql:'].includes(identity.protocol) ||
      !['127.0.0.1', 'localhost', '::1'].includes(identity.hostname.replace(/^\[|\]$/g, '')) ||
      identity.port !== '55449' || identity.pathname !== '/postgres' || identity.search || identity.hash) {
    throw new Error("Workflow fixture admin URL must identify only loopback PostgreSQL port 55449 database postgres.");
  }
  const target = new URL(identity);
  target.pathname = `/${name}`;
  return target.toString();
}

function runPostgresTool(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${path.basename(command)} failed (${result.status}).\n${result.stdout ?? ""}${result.stderr ?? ""}`);
  }
}

async function canConnect(adminUrl) {
  const probe = new Client({ connectionString: adminUrl, connectionTimeoutMillis: 1000 });
  try {
    await probe.connect();
    return true;
  } catch (error) {
    if (["ECONNREFUSED", "ETIMEDOUT"].includes(error?.code)) return false;
    throw error;
  } finally {
    await probe.end().catch(() => {});
  }
}

async function ensureDisposablePostgres(adminUrl) {
  if (await canConnect(adminUrl)) {
    console.log("WORKFLOW_FIXTURE_SERVER=REUSED port=55449");
    return async () => {};
  }
  const identity = new URL(adminUrl);
  const bin = process.env.BIMLOG_POSTGRES_BIN || path.dirname(process.env.BIMLOG_PG_CTL || "C:\\Program Files\\PostgreSQL\\18\\bin\\pg_ctl.exe");
  const pgCtl = process.env.BIMLOG_PG_CTL || path.join(bin, "pg_ctl.exe");
  const initdb = process.env.BIMLOG_INITDB || path.join(bin, "initdb.exe");
  if (!fs.existsSync(pgCtl) || !fs.existsSync(initdb)) {
    throw new Error("Disposable PostgreSQL is unavailable: set BIMLOG_POSTGRES_BIN or start the approved loopback fixture on port 55449.");
  }
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "bimlog-workflow-pg-"));
  const logPath = path.join(dataDir, "postgres.log");
  let started = false;
  try {
    runPostgresTool(initdb, ["-D", dataDir, "-U", identity.username || "postgres", "--auth-local=trust", "--auth-host=trust", "--encoding=UTF8", "--locale=C"]);
    runPostgresTool(pgCtl, ["-D", dataDir, "-l", logPath, "-o", `-h 127.0.0.1 -p ${identity.port}`, "-w", "start"]);
    started = true;
    if (!(await canConnect(adminUrl))) throw new Error("Disposable PostgreSQL started but the approved fixture connection could not be established.");
    console.log(`WORKFLOW_FIXTURE_SERVER=STARTED port=${identity.port}`);
    return async () => {
      runPostgresTool(pgCtl, ["-D", dataDir, "-m", "fast", "-w", "stop"]);
      fs.rmSync(dataDir, { recursive: true, force: true });
      console.log(`WORKFLOW_FIXTURE_SERVER=STOPPED port=${identity.port}`);
    };
  } catch (error) {
    if (started) {
      try { runPostgresTool(pgCtl, ["-D", dataDir, "-m", "immediate", "-w", "stop"]); } catch {}
    }
    fs.rmSync(dataDir, { recursive: true, force: true });
    throw error;
  }
}

async function main() {
  const mode = process.argv[2];
  const name = process.argv[3];
  if (!['--prepare', '--drop', '--run'].includes(mode)) throw new Error("Use --prepare, --drop, or --run with an approved fixture name.");
  const adminUrl = process.env.BIMLOG_WORKFLOW_FIXTURE_ADMIN_URL;
  if (!adminUrl) throw new Error("BIMLOG_WORKFLOW_FIXTURE_ADMIN_URL is required.");
  const targetUrl = validateWorkflowFixture(name, adminUrl);
  const stopDisposablePostgres = await ensureDisposablePostgres(adminUrl);
  const admin = new Client({ connectionString: adminUrl, connectionTimeoutMillis: 3000 });
  try {
    console.log(`WORKFLOW_FIXTURE_DATABASE=CONNECTING database=${name}`);
    await admin.connect();
    console.log(`WORKFLOW_FIXTURE_DATABASE=CONNECTED database=${name}`);
    const drop = async () => {
      await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid <> pg_backend_pid()", [name]);
      await admin.query(`DROP DATABASE IF EXISTS ${name}`);
    };
    try {
      await drop();
      if (mode === '--drop') {
        console.log(`WORKFLOW_FIXTURE_DROP=PASS database=${name}`);
        return;
      }
      await admin.query(`CREATE DATABASE ${name} WITH ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0`);
      if (mode === '--prepare') {
        console.log(`WORKFLOW_FIXTURE_PREPARE=PASS database=${name}`);
        return;
      }
      const separator = process.argv.indexOf('--', 4);
      const command = separator >= 0 ? process.argv[separator + 1] : undefined;
      const args = separator >= 0 ? process.argv.slice(separator + 2) : [];
      if (!command) throw new Error("--run requires a command after --.");
      const result = spawnSync(command, args, { cwd: root, env: { ...process.env, PROD_DATABASE_URL: targetUrl }, stdio: 'inherit', windowsHide: true });
      if (result.error) throw result.error;
      if (result.status !== 0) throw new Error(`Workflow proof command failed with exit ${result.status}.`);
      console.log(`WORKFLOW_FIXTURE_RUN=PASS database=${name}`);
    } finally {
      if (mode === '--run') await drop();
      await admin.end();
    }
  } finally {
    await stopDisposablePostgres();
  }
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
