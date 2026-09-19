import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { collectSchemaContract } from "./check-database-safety.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbDirectory = path.join(root, "lib", "db");
const requireApi = createRequire(path.join(root, "artifacts", "api-server", "package.json"));
const { Client } = requireApi("pg");
const prepare = process.argv.includes("--prepare");
const recreate = process.argv.includes("--recreate");
if (process.argv.some((value, index) => index > 1 && !["--prepare", "--check", "--recreate"].includes(value)))
  throw new Error("Use --prepare, --check, or --prepare --recreate for the local artifact fixture.");
if (recreate && (!prepare || process.env.BIMLOG_ALLOW_DISPOSABLE_FIXTURE_RECREATE !== "YES"))
  throw new Error("Fixture recreation requires --prepare and BIMLOG_ALLOW_DISPOSABLE_FIXTURE_RECREATE=YES.");

const rawUrl = process.env.BIMLOG_ARTIFACT_PROOF_DATABASE_URL;
const rawRoot = process.env.BIMLOG_ARTIFACT_PROOF_ROOT;
if (!rawUrl || !rawRoot)
  throw new Error("Set BIMLOG_ARTIFACT_PROOF_DATABASE_URL and BIMLOG_ARTIFACT_PROOF_ROOT for the isolated local proof.");
const identity = new URL(rawUrl);
const hostname = identity.hostname.replace(/^\[|\]$/g, "");
const port = Number(identity.port);
if (!["postgres:", "postgresql:"].includes(identity.protocol) ||
    !["127.0.0.1", "localhost", "::1"].includes(hostname) ||
    !Number.isInteger(port) || port < 1024 || port > 65535 ||
    identity.pathname !== "/bimlog_rfi_test" || identity.search || identity.hash)
  throw new Error("Artifact fixture URL must identify only loopback PostgreSQL and the exact bimlog_rfi_test database.");
const proofRoot = path.resolve(rawRoot);
if (process.platform === "win32" &&
    !proofRoot.toUpperCase().startsWith("F:\\BIMLOG\\TESTPROOF\\"))
  throw new Error("Artifact proof custody must stay below F:\\BIMLog\\TestProof.");

function run(executable, args, cwd = root) {
  return execFileSync(executable, args, { cwd, encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
}
async function connect(connectionString) {
  const client = new Client({ connectionString, connectionTimeoutMillis: 3000 });
  try { await client.connect(); return client; }
  catch {
    throw new Error("Cannot reach the existing loopback PostgreSQL fixture. Start its F-rooted test cluster; never use a production URL.");
  }
}
const adminIdentity = new URL(rawUrl);
adminIdentity.pathname = "/postgres";
const admin = await connect(adminIdentity.toString());
try {
  const result = await admin.query("SELECT current_database() db, host(inet_server_addr()) host, inet_server_port() port, current_setting('data_directory') data_dir");
  const observed = result.rows[0];
  if (observed.db !== "postgres" || Number(observed.port) !== port ||
      !["127.0.0.1", "::1"].includes(observed.host) ||
      (process.platform === "win32" &&
       !path.resolve(observed.data_dir).toUpperCase().startsWith("F:\\BIMLOG\\TESTPROOF\\")))
    throw new Error("The responding PostgreSQL service is not the verified F-rooted loopback test cluster.");
  let existing = await admin.query("SELECT pg_encoding_to_char(encoding) encoding FROM pg_database WHERE datname='bimlog_rfi_test'");
  if (recreate && existing.rows.length) {
    await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='bimlog_rfi_test' AND pid <> pg_backend_pid()");
    await admin.query("DROP DATABASE bimlog_rfi_test");
    existing = { rows: [] };
  }
  if (!existing.rows.length) {
    if (!prepare) throw new Error("Disposable bimlog_rfi_test is absent. Run this fixture helper with --prepare first.");
    await admin.query("CREATE DATABASE bimlog_rfi_test WITH ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0");
  } else if (existing.rows[0].encoding !== "UTF8") {
    throw new Error("Disposable bimlog_rfi_test is not UTF-8. Preserve it for diagnosis; do not truncate or overwrite it.");
  }
} finally { await admin.end(); }

const fixture = await connect(rawUrl);
try {
  const result = await fixture.query("SELECT current_database() db, current_setting('server_encoding') encoding, host(inet_server_addr()) host, inet_server_port() port");
  const observed = result.rows[0];
  if (observed.db !== "bimlog_rfi_test" || observed.encoding !== "UTF8" ||
      Number(observed.port) !== port || !["127.0.0.1", "::1"].includes(observed.host))
    throw new Error("Artifact fixture identity or UTF-8 encoding changed.");
  const before = await fixture.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
  if (!before.rows.length) {
    if (!prepare) throw new Error("Disposable artifact fixture has no base schema. Run this helper with --prepare first.");
    const cli = path.join(dbDirectory, "node_modules", "drizzle-kit", "bin.cjs");
    if (!fs.existsSync(cli)) throw new Error("Repository-pinned Drizzle CLI is not installed.");
    run(process.execPath, [cli, "push", "--dialect", "postgresql", "--schema", "./src/schema/index.ts", "--url", rawUrl], dbDirectory);
  }
  const after = await fixture.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
  const actual = new Set(after.rows.map((row) => row.tablename));
  const missing = collectSchemaContract().tables.filter((table) => !actual.has(table));
  if (missing.length)
    throw new Error("Disposable artifact fixture is incomplete (" + missing.length + " declared tables missing). Preserve it and use a fresh UTF-8 fixture.");
} finally { await fixture.end(); }

if (!fs.existsSync(proofRoot)) {
  if (!prepare) throw new Error("Private artifact proof directory is absent. Run this helper with --prepare first.");
  fs.mkdirSync(proofRoot, { recursive: true });
}
const realRoot = fs.realpathSync.native(proofRoot);
if (fs.lstatSync(proofRoot).isSymbolicLink() ||
    (process.platform === "win32" &&
     !realRoot.toUpperCase().startsWith("F:\\BIMLOG\\TESTPROOF\\")))
  throw new Error("Artifact proof root escaped F-rooted custody.");
if (process.platform === "win32") {
  if (prepare) {
    run("icacls.exe", [proofRoot, "/inheritance:d"]);
    const account = process.env.USERDOMAIN + "\\" + process.env.USERNAME;
    run("icacls.exe", [proofRoot, "/grant", account + ":(OI)(CI)(M)"]);
    const current = run("icacls.exe", [proofRoot]);
    const broad = ["NT AUTHORITY\\Authenticated Users", "NT AUTHORITY\\Usuarios autentificados",
      "BUILTIN\\Users", "BUILTIN\\Usuarios", "Everyone", "Todos"];
    for (const principal of broad)
      if (current.toLowerCase().includes(principal.toLowerCase()))
        run("icacls.exe", [proofRoot, "/remove:g", principal]);
  }
  const acl = run("icacls.exe", [proofRoot]);
  if (/(?:Everyone|Todos|Authenticated Users|Usuarios autentificados|BUILTIN\\Users|BUILTIN\\Usuarios)/i.test(acl))
    throw new Error("Artifact proof root grants broad access; private custody is required.");
}
console.log("Artifact fixture ready: loopback UTF-8 bimlog_rfi_test, complete declared schema, private F-rooted proof custody.");
