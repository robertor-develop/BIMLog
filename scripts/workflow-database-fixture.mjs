import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireApi = createRequire(path.join(root, "artifacts", "api-server", "package.json"));
const { Client } = requireApi("pg");
export const workflowFixtureNames = Object.freeze([
  "delivery_template_test",
  "delivery_runtime_test",
  "economic_allocation_test",
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

async function main() {
  const mode = process.argv[2];
  const name = process.argv[3];
  if (!['--prepare', '--drop', '--run'].includes(mode)) throw new Error("Use --prepare, --drop, or --run with an approved fixture name.");
  const adminUrl = process.env.BIMLOG_WORKFLOW_FIXTURE_ADMIN_URL;
  if (!adminUrl) throw new Error("BIMLOG_WORKFLOW_FIXTURE_ADMIN_URL is required.");
  const targetUrl = validateWorkflowFixture(name, adminUrl);
  const admin = new Client({ connectionString: adminUrl, connectionTimeoutMillis: 3000 });
  await admin.connect();
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
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
