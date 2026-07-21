import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const connection = process.env.PROD_DATABASE_URL;
if (!connection) throw new Error("An isolated local PROD_DATABASE_URL is required");
const identity = new URL(connection);
if (!['127.0.0.1', 'localhost', '::1'].includes(identity.hostname) || identity.port !== '55437' || identity.pathname !== '/bimlog_living_brief_review') {
  throw new Error("Refusing to run outside the approved disposable Living Brief database");
}
process.env.JWT_SECRET ||= "living-brief-disposable-runtime-secret-only";
process.env.BIMLOG_SOURCE_COMMIT ||= "a6d3b1916319bfd0f473d9ec9e1978f166f407dc";

const repoRoot = path.resolve(import.meta.dirname, "../../../..");
const sourceFixture = fs.mkdtempSync(path.join(os.tmpdir(), "bimlog-living-brief-runtime-"));
fs.cpSync(path.join(repoRoot, "living-brief"), sourceFixture, { recursive: true });
process.env.BIMLOG_LIVING_BRIEF_SOURCE_DIR = sourceFixture;

const { pool } = await import("@workspace/db");
const { ensureLivingBriefGateSchema, ensureLivingBriefMirrorSchema } = await import("./living-brief-migration");
const mirror = await import("./living-brief-mirror");
const sourceModule = await import("./living-brief-source");
const { default: livingBriefRouter } = await import("../routes/living_brief");
const { signBriefAccessToken, signToken } = await import("../middlewares/auth");
const { default: express } = await import("express");

const checks: string[] = [];
const check = (name: string, condition: unknown) => { assert.ok(condition, name); checks.push(name); };
const canonical = (value: string) => value.replace(/\r\n?/g, "\n");
const hash = (value: string) => crypto.createHash("sha256").update(canonical(value)).digest("hex");

await pool.query(`DROP TABLE IF EXISTS living_brief_documents CASCADE`);
await pool.query(`DROP TABLE IF EXISTS living_brief_gate_audit CASCADE`);
await pool.query(`DROP TABLE IF EXISTS living_brief_gate_credentials CASCADE`);
await pool.query(`DROP TABLE IF EXISTS platform_settings CASCADE`);
await pool.query(`DROP TABLE IF EXISTS users CASCADE`);
await pool.query(`DROP TABLE IF EXISTS companies CASCADE`);
await pool.query(`CREATE TABLE companies (id serial PRIMARY KEY, name text NOT NULL)`);
await pool.query(`CREATE TABLE users (
  id serial PRIMARY KEY, email text NOT NULL UNIQUE, password_hash text NOT NULL,
  full_name text NOT NULL, company_id integer NOT NULL REFERENCES companies(id),
  created_at timestamp NOT NULL DEFAULT now(), is_super_admin boolean NOT NULL DEFAULT false,
  can_access_living_brief boolean NOT NULL DEFAULT false
)`);
await pool.query(`CREATE TABLE platform_settings (
  id serial PRIMARY KEY, key text NOT NULL UNIQUE, value text NOT NULL, updated_at timestamp NOT NULL DEFAULT now()
)`);
await ensureLivingBriefMirrorSchema();
await ensureLivingBriefMirrorSchema();
await ensureLivingBriefGateSchema();
await ensureLivingBriefGateSchema();
check("additive idempotent migration", true);

await pool.query(`INSERT INTO companies(id,name) VALUES (910001,'Living Brief Runtime')`);
await pool.query(`INSERT INTO users(id,email,password_hash,full_name,company_id,is_super_admin,can_access_living_brief) VALUES
  (910001,'living-brief-admin@example.test','unused','Runtime Admin',910001,true,true),
  (910002,'living-brief-reader@example.test','unused','Runtime Reader',910001,false,true),
  (910003,'living-brief-denied@example.test','unused','Runtime Denied',910001,false,false)`);
await pool.query(`INSERT INTO platform_settings(key,value) VALUES ('living_brief_password_hash','unused-runtime-hash')`);

await mirror.synchronizeLivingBriefMirror();
const source = sourceModule.loadLivingBriefSource();
let rows = await mirror.readLivingBriefMirrorRows();
check("initial synchronization has all 11 catalog entries", rows.size === 11 && source.documents.length === 11);
for (const document of source.documents) {
  const row = rows.get(document.key)!;
  assert.equal(canonical(row.content), document.content);
  assert.equal(row.source_sha256, document.sha256);
  assert.equal(hash(row.content), document.sha256);
  assert.equal(row.deployed_source_commit, process.env.BIMLOG_SOURCE_COMMIT);
  assert.equal(row.reconciled_through_commit, document.reconciledThroughCommit);
  assert.equal(row.source_changed_at.toISOString(), new Date(document.sourceChangedAt).toISOString());
  assert.ok(row.mirror_synced_at instanceof Date);
  assert.equal(row.synchronization_result, "current");
  assert.equal(Number(row.version), 1);
}
check("exact content and complete mirror metadata persisted", true);

const initialSnapshot = [...rows.values()].map((row) => ({ key: row.document_key, version: Number(row.version), synced: row.mirror_synced_at.toISOString() }));
await mirror.synchronizeLivingBriefMirror();
rows = await mirror.readLivingBriefMirrorRows();
assert.deepEqual([...rows.values()].map((row) => ({ key: row.document_key, version: Number(row.version), synced: row.mirror_synced_at.toISOString() })), initialSnapshot);
check("repeated synchronization and restart are idempotent", true);

const first = source.documents[0];
await pool.query(`UPDATE living_brief_documents SET content='database-only doctrine' WHERE document_key=$1`, [first.key]);
await mirror.synchronizeLivingBriefMirror();
rows = await mirror.readLivingBriefMirrorRows();
assert.equal(rows.get(first.key)!.content, "database-only doctrine");
assert.equal(rows.get(first.key)!.source_sha256, first.sha256);
assert.equal(rows.get(first.key)!.synchronization_result, "mismatch");
check("database drift is preserved as mismatch and source identity remains exact", true);

await assert.rejects(
  mirror.reconcileLivingBriefMirror(Object.fromEntries(source.documents.map((document) => [document.key, "0".repeat(64)]))),
  /Mirror changed concurrently/,
);
assert.equal((await mirror.readLivingBriefMirrorRows()).get(first.key)!.content, "database-only doctrine");
check("observed mirror hash mismatch blocks reconciliation", true);

await pool.query(`INSERT INTO living_brief_documents
  (document_key,content,deployed_source_commit,reconciled_through_commit,source_sha256,source_changed_at,mirror_synced_at,synchronization_result,version)
  VALUES ('unknown_doctrine','x',$1,$1,$2,now(),now(),'current',1)`, [process.env.BIMLOG_SOURCE_COMMIT, hash("x")]);
await assert.rejects(mirror.synchronizeLivingBriefMirror(), /Unknown Living Brief document key/);
await pool.query(`DELETE FROM living_brief_documents WHERE document_key='unknown_doctrine'`);
check("unknown database document keys are rejected", true);

await pool.query(`DELETE FROM living_brief_documents WHERE document_key=$1`, [source.documents[1].key]);
const tenHashes = Object.fromEntries([...(await mirror.readLivingBriefMirrorRows()).values()].map((row) => [row.document_key, hash(row.content)]));
await assert.rejects(mirror.reconcileLivingBriefMirror(tenHashes), /Mirror row is missing/);
await mirror.synchronizeLivingBriefMirror();
check("missing mirror rows fail reconciliation and synchronize safely", (await mirror.readLivingBriefMirrorRows()).size === 11);

const visionPath = path.join(sourceFixture, "VISION.md");
const visionOriginal = fs.readFileSync(visionPath, "utf8");
fs.writeFileSync(visionPath, `${visionOriginal}\nunsynchronized drift\n`);
await assert.rejects(mirror.synchronizeLivingBriefMirror(), /source hash mismatch/);
fs.writeFileSync(visionPath, visionOriginal);
check("missing or hash-drifted source fails before database mutation", true);

const realDirectory = path.join(repoRoot, "living-brief");
const savedOverride = process.env.BIMLOG_LIVING_BRIEF_SOURCE_DIR;
delete process.env.BIMLOG_LIVING_BRIEF_SOURCE_DIR;
const realSource = sourceModule.loadLivingBriefSource();
const savedCommit = process.env.BIMLOG_SOURCE_COMMIT;
for (const claim of ["0".repeat(40), "13f9fe994ed662552c16f028f4ec21c5143071ea"]) {
  process.env.BIMLOG_SOURCE_COMMIT = claim;
  assert.throws(() => sourceModule.resolveDeployedSourceCommit(realSource.manifest, realDirectory), /invalid|descendant/);
}
process.env.BIMLOG_SOURCE_COMMIT = savedCommit;
process.env.BIMLOG_LIVING_BRIEF_SOURCE_DIR = savedOverride;
const statePath = path.join(sourceFixture, "state.json");
const stateOriginal = fs.readFileSync(statePath, "utf8");
const futureState = JSON.parse(stateOriginal);
futureState.documents[0].sourceChangedAt = "2999-01-01T00:00:00.000Z";
fs.writeFileSync(statePath, JSON.stringify(futureState));
assert.throws(() => sourceModule.loadLivingBriefSource(), /future source-change claim/);
fs.writeFileSync(statePath, stateOriginal);
check("invalid nonancestor stale and future commit claims are rejected", true);

const lockClient = await pool.connect();
await lockClient.query("BEGIN");
await lockClient.query("SELECT pg_advisory_xact_lock($1)", [10472917]);
let lockSettled = false;
const blockedSync = mirror.synchronizeLivingBriefMirror().finally(() => { lockSettled = true; });
await new Promise((resolve) => setTimeout(resolve, 150));
assert.equal(lockSettled, false);
await lockClient.query("COMMIT");
lockClient.release();
await blockedSync;
check("advisory locking serializes synchronization", true);

rows = await mirror.readLivingBriefMirrorRows();
const expectedBeforeSourceChange = Object.fromEntries([...rows.values()].map((row) => [row.document_key, hash(row.content)]));
const sourceLock = await pool.connect();
await sourceLock.query("BEGIN");
await sourceLock.query("SELECT pg_advisory_xact_lock($1)", [10472917]);
const concurrentReconcile = mirror.reconcileLivingBriefMirror(expectedBeforeSourceChange);
await new Promise((resolve) => setTimeout(resolve, 100));
const concurrentState = JSON.parse(stateOriginal);
const changedContent = `${visionOriginal}\ncontrolled concurrent source change\n`;
fs.writeFileSync(visionPath, changedContent);
const visionMetadata = concurrentState.documents.find((document: { file: string }) => document.file === "VISION.md");
visionMetadata.sha256 = hash(changedContent);
visionMetadata.sourceChangedAt = new Date().toISOString();
concurrentState.bundleSha256 = crypto.createHash("sha256").update(concurrentState.documents.map((document: { key: string; sha256: string }) => `${document.key}:${document.sha256}`).join("\n")).digest("hex");
fs.writeFileSync(statePath, JSON.stringify(concurrentState));
await sourceLock.query("COMMIT");
sourceLock.release();
await assert.rejects(concurrentReconcile, /source changed concurrently/);
fs.writeFileSync(visionPath, visionOriginal);
fs.writeFileSync(statePath, stateOriginal);
check("concurrent source change is detected without success", true);

rows = await mirror.readLivingBriefMirrorRows();
const rollbackBefore = [...rows.values()].map((row) => ({ key: row.document_key, content: row.content, version: Number(row.version) }));
const rollbackExpected = Object.fromEntries([...rows.values()].map((row) => [row.document_key, hash(row.content)]));
await pool.query(`CREATE OR REPLACE FUNCTION living_brief_runtime_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF NEW.document_key='plugin' THEN RAISE EXCEPTION 'controlled runtime rollback'; END IF; RETURN NEW; END $$`);
await pool.query(`CREATE TRIGGER living_brief_runtime_fail_trigger BEFORE UPDATE ON living_brief_documents FOR EACH ROW EXECUTE FUNCTION living_brief_runtime_fail()`);
await assert.rejects(mirror.reconcileLivingBriefMirror(rollbackExpected), /controlled runtime rollback/);
await pool.query(`DROP TRIGGER living_brief_runtime_fail_trigger ON living_brief_documents`);
await pool.query(`DROP FUNCTION living_brief_runtime_fail()`);
rows = await mirror.readLivingBriefMirrorRows();
assert.deepEqual([...rows.values()].map((row) => ({ key: row.document_key, content: row.content, version: Number(row.version) })), rollbackBefore);
check("transaction rollback leaves no partial document state", true);

const app = express();
app.use(express.json());
app.use("/api/v1", livingBriefRouter);
app.use((error: unknown, _request: unknown, response: { status(code: number): { json(body: unknown): void } }) => {
  response.status(409).json({ error: error instanceof Error ? error.message : "Living Brief operation failed" });
});
const server = await new Promise<import("node:http").Server>((resolve) => {
  const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
});
const address = server.address();
if (!address || typeof address === "string") throw new Error("Disposable API did not bind");
const base = `http://127.0.0.1:${address.port}/api/v1`;
const auth = (userId: number, email: string, isSuperAdmin = false) => signToken({ userId, email, companyId: 910001, fullName: "Runtime", companyName: "Runtime", isSuperAdmin });
const readerToken = auth(910002, "living-brief-reader@example.test");
const adminToken = auth(910001, "living-brief-admin@example.test", true);
const readerBrief = signBriefAccessToken(910002, 1);
const api = async (pathname: string, token?: string, init: RequestInit = {}) => {
  const response = await fetch(`${base}${pathname}`, { ...init, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...init.headers } });
  return { status: response.status, body: await response.json() as Record<string, unknown> };
};
const readResult = await api("/living-brief/docs", readerToken, { headers: { "x-brief-token": readerBrief } });
assert.equal(readResult.status, 200);
assert.equal((readResult.body.docs as unknown[]).length, 11);
const ordinaryMutation = await api("/living-brief/reconcile", readerToken, { method: "POST", body: JSON.stringify({ expectedMirrorHashes: {} }) });
assert.equal(ordinaryMutation.status, 403);
assert.equal((await api("/living-brief/reconcile", undefined, { method: "POST", body: "{}" })).status, 401);
check("authenticated ordinary users are read-only and admin authority is required", true);

await pool.query(`UPDATE living_brief_documents SET content='api mismatch' WHERE document_key=$1`, [first.key]);
rows = await mirror.readLivingBriefMirrorRows();
const apiExpected = Object.fromEntries([...rows.values()].map((row) => [row.document_key, hash(row.content)]));
const adminReconcile = await api("/living-brief/reconcile", adminToken, { method: "POST", body: JSON.stringify({ expectedMirrorHashes: apiExpected }) });
assert.equal(adminReconcile.status, 200);
rows = await mirror.readLivingBriefMirrorRows();
assert.equal(rows.get(first.key)!.content, first.content);
assert.equal(rows.get(first.key)!.synchronization_result, "current");
check("authenticated admin API copies only verified source after observed hashes", true);

const returnedDocs = readResult.body.docs as Array<Record<string, unknown>>;
const serializedResponses = JSON.stringify({
  readStatus: readResult.status,
  documentMetadata: returnedDocs.map(({ content: _content, ...metadata }) => metadata),
  ordinaryMutation: ordinaryMutation.body,
  adminReconcile: adminReconcile.body,
});
assert.doesNotMatch(serializedResponses, /postgres(?:ql)?:\/\/|JWT_SECRET|password_hash|[A-Z]:\\|node_modules|\.git[\\/]/i);
check("API responses expose no credentials filesystem paths or repository internals", true);

await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
await mirror.synchronizeLivingBriefMirror();
assert.equal((await mirror.readLivingBriefMirrorRows()).size, 11);
check("API restart synchronization preserves status without duplicate versions", true);

await pool.query(`TRUNCATE living_brief_documents, platform_settings, users, companies RESTART IDENTITY CASCADE`);
const markerCount = await pool.query<{ n: number }>(`SELECT
  (SELECT count(*) FROM living_brief_documents) +
  (SELECT count(*) FROM platform_settings) +
  (SELECT count(*) FROM users) +
  (SELECT count(*) FROM companies) AS n`);
assert.equal(Number(markerCount.rows[0].n), 0);
check("disposable database contains zero remaining test markers", true);

await pool.end();
fs.rmSync(sourceFixture, { recursive: true, force: true });
console.log(JSON.stringify({ suite: "living-brief-disposable-runtime", database: { local: true, isolated: true }, passed: checks.length, checks }, null, 2));
