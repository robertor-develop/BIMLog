import assert from "node:assert/strict";
import { createServer } from "node:http";
import fs from "node:fs";
import path from "node:path";
import express from "express";
// @ts-expect-error The runtime package is present; this isolated fixture does not require its optional declaration package.
import pg from "pg";

const urlText = process.env.BIMLOG_FEEDBACK_TEST_DATABASE_URL;
if (!urlText) throw new Error("BIMLOG_FEEDBACK_TEST_DATABASE_URL is required");
const parsed = new URL(urlText);
if (!(["127.0.0.1", "localhost", "::1"].includes(parsed.hostname)) || parsed.pathname !== "/bimlog_feedback_test" || parsed.search || parsed.hash) throw new Error("Feedback test DB must be an exact loopback-only bimlog_feedback_test database");
process.env.PROD_DATABASE_URL = urlText;
process.env.JWT_SECRET = "feedback-local-fixture-secret-at-least-32-bytes";
delete process.env.BIMLOG_FEEDBACK_SCANNER;
const uploadRoot = path.resolve(".tmp", "feedback-http-uploads"); if (fs.existsSync(uploadRoot)) throw new Error("Feedback upload proof root must not exist"); process.env.BIMLOG_FEEDBACK_UPLOAD_ROOT = uploadRoot;
process.env.BIMLOG_FEEDBACK_STORAGE_BACKEND = "local-test";

const { default: router } = await import("../routes/feedback");
const { signToken } = await import("../middlewares/auth");
const { ensureFeedbackSchema, FEEDBACK_SCHEMA_ADVISORY_LOCK } = await import("./feedback-schema-migration");
const { pool: appPool } = await import("@workspace/db");
const testPool = new pg.Pool({ connectionString: urlText });
await testPool.query(`DROP TABLE IF EXISTS feedback_transcription_jobs, feedback_capture_consents, feedback_audit_events, feedback_assets, feedback_items, project_members, projects, users, companies, fixture_failures; DROP FUNCTION IF EXISTS fixture_reject_audit()`);
await assert.rejects(() => ensureFeedbackSchema(testPool)); assert.equal((await testPool.query("select to_regclass('feedback_items') value")).rows[0].value, null);
await testPool.query(`
  CREATE TABLE companies(id integer PRIMARY KEY, name text NOT NULL);
  CREATE TABLE users(id integer PRIMARY KEY, email text NOT NULL, full_name text NOT NULL, company_id integer NOT NULL REFERENCES companies(id), is_super_admin boolean NOT NULL DEFAULT false);
  CREATE TABLE projects(id integer PRIMARY KEY, name text NOT NULL, code text NOT NULL, status text NOT NULL, created_by_id integer NOT NULL REFERENCES users(id), created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now());
  CREATE TABLE project_members(id serial PRIMARY KEY, project_id integer NOT NULL REFERENCES projects(id), user_id integer NOT NULL REFERENCES users(id), role text NOT NULL, joined_at timestamp NOT NULL DEFAULT now(), permissions_override jsonb, status text DEFAULT 'active');
  INSERT INTO companies VALUES (1,'A'),(2,'B'); INSERT INTO users VALUES (11,'a@test.invalid','A',1,false),(22,'b@test.invalid','B',2,false),(33,'admin@test.invalid','Admin',1,true); INSERT INTO projects VALUES (101,'A project','A-1','active',11,now(),now()); INSERT INTO project_members(project_id,user_id,role,status) VALUES(101,11,'member','active');
`);
const lockOwner = await testPool.connect(); await lockOwner.query("BEGIN"); await lockOwner.query(`select pg_advisory_xact_lock(${FEEDBACK_SCHEMA_ADVISORY_LOCK})`);
let migrationSettled = false; const serializedMigration = ensureFeedbackSchema(testPool).finally(() => { migrationSettled = true; });
await new Promise(resolve => setTimeout(resolve, 100)); assert.equal(migrationSettled, false); await lockOwner.query("COMMIT"); lockOwner.release(); await serializedMigration; await ensureFeedbackSchema(testPool);
await testPool.query(`CREATE TABLE fixture_failures(event_type text PRIMARY KEY); CREATE FUNCTION fixture_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS(SELECT 1 FROM fixture_failures WHERE event_type=NEW.event_type) THEN RAISE EXCEPTION 'fixture audit refusal'; END IF; RETURN NEW; END $$; CREATE TRIGGER fixture_reject_audit_trigger BEFORE INSERT ON feedback_audit_events FOR EACH ROW EXECUTE FUNCTION fixture_reject_audit()`);

const app = express(); app.use(express.json()); app.use("/api/v1", router); const server = createServer(app); await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
const address = server.address(); if (!address || typeof address === "string") throw new Error("test server failed"); const base = `http://127.0.0.1:${address.port}/api/v1`;
const tokenA = signToken({ userId: 11, email: "a@test.invalid", companyId: 1, fullName: "A", companyName: "A" });
const tokenB = signToken({ userId: 22, email: "b@test.invalid", companyId: 2, fullName: "B", companyName: "B" });
const tokenAdmin = signToken({ userId: 33, email: "admin@test.invalid", companyId: 1, fullName: "Admin", companyName: "A", isSuperAdmin: true });
const headers = (token: string, key?: string) => ({ "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(key ? { "Idempotency-Key": key } : {}) });
const body = { feedbackType: "bug", priority: "high", message: "Concurrent governed fixture", module: "Fixture", projectId: 101, pageUrl: "http://localhost/fixture", metadata: { userEmail: "must-not-persist@example.invalid", arbitrary: "must-not-persist", viewport: "390x844", language: "es" } };
try {
  await testPool.query("insert into fixture_failures values ('created')"); const rolledBack = await fetch(`${base}/feedback`, { method: "POST", headers: headers(tokenA, "rollback-key"), body: JSON.stringify(body) }); assert.equal(rolledBack.status, 500); assert.equal((await testPool.query("select count(*)::int n from feedback_items")).rows[0].n, 0); await testPool.query("delete from fixture_failures");
  const concurrent = await Promise.all(Array.from({ length: 4 }, () => fetch(`${base}/feedback`, { method: "POST", headers: headers(tokenA, "same-key"), body: JSON.stringify(body) })));
  assert.ok(concurrent.every(response => [200, 201].includes(response.status))); const payloads = await Promise.all(concurrent.map(response => response.json())) as Array<{ feedback: { id: number } }>; assert.equal(new Set(payloads.map(value => value.feedback.id)).size, 1);
  const count = await testPool.query("select count(*)::int n from feedback_items"); assert.equal(count.rows[0].n, 1); const audits = await testPool.query("select count(*)::int n from feedback_audit_events where event_type='created'"); assert.equal(audits.rows[0].n, 1);
  const divergent = await fetch(`${base}/feedback`, { method: "POST", headers: headers(tokenA, "same-key"), body: JSON.stringify({ ...body, message: "different" }) }); assert.equal(divergent.status, 409);
  const denied = await fetch(`${base}/feedback`, { method: "POST", headers: headers(tokenB, "cross-company"), body: JSON.stringify(body) }); assert.equal(denied.status, 403);
  const id = payloads[0].feedback.id; await testPool.query("update project_members set status='suspended' where user_id=11"); const suspended = await fetch(`${base}/feedback/${id}/history`, { headers: { Authorization: `Bearer ${tokenA}` } }); assert.equal(suspended.status, 403);
  await testPool.query("update project_members set status='active' where user_id=11"); const file = new FormData(); file.append("kind", "attachment"); file.append("files", new Blob(["bounded fixture"], { type: "text/plain" }), "field-note.txt"); file.append("transformations", JSON.stringify({ "asset-key": { origin: "user-file-import" } })); const uploaded = await fetch(`${base}/feedback/${id}/assets`, { method: "POST", headers: { Authorization: `Bearer ${tokenA}`, "Idempotency-Key": "asset-key" }, body: file }); assert.equal(uploaded.status, 201);
  const assetPayload = await uploaded.json() as { assets: Array<{ id: number; scanState: string }> }; assert.equal(assetPayload.assets[0].scanState, "quarantined"); const download = await fetch(`${base}/feedback/${id}/assets/${assetPayload.assets[0].id}/download`, { headers: { Authorization: `Bearer ${tokenA}` } }); assert.equal(download.status, 423);
  const duplicate = new FormData(); duplicate.append("kind", "attachment"); duplicate.append("files", new Blob(["bounded fixture"], { type: "text/plain" }), "field-note.txt"); duplicate.append("transformations", JSON.stringify({ "asset-key": { origin: "user-file-import" } })); const duplicateResponse = await fetch(`${base}/feedback/${id}/assets`, { method: "POST", headers: { Authorization: `Bearer ${tokenA}`, "Idempotency-Key": "asset-key" }, body: duplicate }); assert.equal(duplicateResponse.status, 200); const assets = await testPool.query("select count(*)::int n from feedback_assets"); assert.equal(assets.rows[0].n, 1);
  const storedFiles = fs.existsSync(uploadRoot) ? fs.readdirSync(uploadRoot, { recursive: true }).filter(value => /^[a-f0-9]{64}$/.test(path.basename(String(value)))) : []; assert.equal(storedFiles.length, 1);
  await testPool.query("update feedback_assets set scan_state='clean', scanner_adapter='local-fixture', scanned_at=now() where id=$1", [assetPayload.assets[0].id]); const cleanDownload = await fetch(`${base}/feedback/${id}/assets/${assetPayload.assets[0].id}/download`, { headers: { Authorization: `Bearer ${tokenA}` } }); assert.equal(cleanDownload.status, 200); assert.equal(await cleanDownload.text(), "bounded fixture");
  const triage = await Promise.all(["one", "two"].map(() => fetch(`${base}/feedback/admin/${id}`, { method: "PATCH", headers: headers(tokenAdmin), body: JSON.stringify({ observedVersion: 1, status: "triaged" }) }))); assert.deepEqual(triage.map(value => value.status).sort(), [200, 409]);
  await testPool.query("insert into fixture_failures values ('triage_updated')"); const auditRollback = await fetch(`${base}/feedback/admin/${id}`, { method: "PATCH", headers: headers(tokenAdmin), body: JSON.stringify({ observedVersion: 2, status: "accepted" }) }); assert.equal(auditRollback.status, 500); assert.equal((await testPool.query("select status from feedback_items where id=$1", [id])).rows[0].status, "triaged"); await testPool.query("delete from fixture_failures");
  await testPool.query("update feedback_items set status='verified', version=3 where id=$1", [id]); const staleReopen = await fetch(`${base}/feedback/${id}/reopen`, { method: "POST", headers: headers(tokenA), body: JSON.stringify({ observedVersion: 2, reason: "stale" }) }); assert.equal(staleReopen.status, 409);
  await testPool.query("update feedback_items set customer_visible=false where id=$1", [id]); assert.equal((await fetch(`${base}/feedback/${id}/history`, { headers: { Authorization: `Bearer ${tokenA}` } })).status, 403); await testPool.query("update feedback_items set customer_visible=true where id=$1", [id]);
  await testPool.query("insert into feedback_capture_consents(id,actor_user_id,feedback_id,capture_kind,purpose,notice_version) values('audio-consent',11,$1,'audio','fixture','feedback-capture-v1')", [id]); const audio = await testPool.query("insert into feedback_assets(feedback_id,project_id,uploaded_by_id,kind,original_name,safe_name,media_type,byte_size,sha256,storage_path,scan_state,scanner_adapter,scanned_at,provenance) values($1,101,11,'audio','voice.webm','voice.webm','audio/webm',4,'sourcehash','fixture','clean','local-fixture',now(),'{}') returning id", [id]);
  const transcriptionHeaders = { ...headers(tokenA, "transcription-key") }; const transcriptionBody = JSON.stringify({ assetId: audio.rows[0].id, consentId: "audio-consent" }); const blocked = await fetch(`${base}/feedback/${id}/transcription`, { method: "POST", headers: transcriptionHeaders, body: transcriptionBody }); assert.equal(blocked.status, 424); const replay = await fetch(`${base}/feedback/${id}/transcription`, { method: "POST", headers: transcriptionHeaders, body: transcriptionBody }); assert.equal(replay.status, 424); assert.equal((await testPool.query("select count(*)::int n from feedback_transcription_jobs")).rows[0].n, 1);
  const formula = await fetch(`${base}/feedback`, { method: "POST", headers: headers(tokenA, "formula-key"), body: JSON.stringify({ ...body, message: "=HYPERLINK(\"bad\")" }) }); assert.equal(formula.status, 201); const csv = await fetch(`${base}/feedback/admin/export.csv`, { headers: { Authorization: `Bearer ${tokenAdmin}`, "X-Export-Reason": "fixture review" } }); assert.equal(csv.status, 200); assert.match(await csv.text(), /'=HYPERLINK/);
  assert.equal((await testPool.query("select retention_hold,expires_at from feedback_assets where id=$1", [assetPayload.assets[0].id])).rows[0].retention_hold, true);
  console.log("feedback DB/HTTP contract: 30/30 passed");
} finally { await new Promise<void>(resolve => server.close(() => resolve())); await appPool.end(); await testPool.end(); if (fs.existsSync(uploadRoot)) fs.rmSync(uploadRoot, { recursive: true }); }
