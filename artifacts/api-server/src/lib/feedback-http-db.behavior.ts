import assert from "node:assert/strict";
import { createServer } from "node:http";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import pg from "pg";

const urlText = process.env.BIMLOG_FEEDBACK_TEST_DATABASE_URL;
if (!urlText) throw new Error("BIMLOG_FEEDBACK_TEST_DATABASE_URL is required");
const parsed = new URL(urlText);
if (!(["127.0.0.1", "localhost", "::1"].includes(parsed.hostname)) || parsed.pathname !== "/bimlog_feedback_test" || parsed.search || parsed.hash) throw new Error("Feedback test DB must be an exact loopback-only bimlog_feedback_test database");
process.env.PROD_DATABASE_URL = urlText;
process.env.JWT_SECRET = "feedback-local-fixture-secret-at-least-32-bytes";
delete process.env.BIMLOG_FEEDBACK_SCANNER;

const { default: router } = await import("../routes/feedback");
const { signToken } = await import("../middlewares/auth");
const { pool: appPool } = await import("@workspace/db");
const testPool = new pg.Pool({ connectionString: urlText });
await testPool.query(`
  DROP TABLE IF EXISTS feedback_transcription_jobs, feedback_audit_events, feedback_assets, feedback_items, project_members, projects, users, companies;
  CREATE TABLE companies(id integer PRIMARY KEY, name text NOT NULL);
  CREATE TABLE users(id integer PRIMARY KEY, email text NOT NULL, full_name text NOT NULL, company_id integer NOT NULL REFERENCES companies(id), is_super_admin boolean NOT NULL DEFAULT false);
  CREATE TABLE projects(id integer PRIMARY KEY, name text NOT NULL, code text NOT NULL, status text NOT NULL, created_by_id integer NOT NULL REFERENCES users(id), created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now());
  CREATE TABLE project_members(id serial PRIMARY KEY, project_id integer NOT NULL REFERENCES projects(id), user_id integer NOT NULL REFERENCES users(id), role text NOT NULL, joined_at timestamp NOT NULL DEFAULT now(), permissions_override jsonb, status text DEFAULT 'active');
  CREATE TABLE feedback_items(id serial PRIMARY KEY, user_id integer NOT NULL REFERENCES users(id), project_id integer REFERENCES projects(id), feedback_type text NOT NULL, priority text NOT NULL, module text, page_url text NOT NULL, message text NOT NULL, status text NOT NULL, stable_id text NOT NULL UNIQUE, company_id integer NOT NULL REFERENCES companies(id), owner_user_id integer REFERENCES users(id), target_release text, disposition_reason text, customer_visible boolean NOT NULL DEFAULT true, version integer NOT NULL DEFAULT 1, idempotency_key text, request_hash text, transcript text, transcript_provenance text, metadata jsonb, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(), resolved_at timestamp, UNIQUE(user_id,idempotency_key));
  CREATE TABLE feedback_assets(id serial PRIMARY KEY, feedback_id integer NOT NULL REFERENCES feedback_items(id), project_id integer REFERENCES projects(id), uploaded_by_id integer NOT NULL REFERENCES users(id), kind text NOT NULL, original_name text NOT NULL, safe_name text NOT NULL, media_type text NOT NULL, byte_size bigint NOT NULL, sha256 text NOT NULL, storage_path text NOT NULL, scan_state text NOT NULL, scanner_adapter text NOT NULL, scanned_at timestamp, retention_hold boolean NOT NULL DEFAULT true, expires_at timestamp, provenance jsonb NOT NULL DEFAULT '{}', created_at timestamp NOT NULL DEFAULT now(), UNIQUE(feedback_id,sha256));
  CREATE TABLE feedback_audit_events(id serial PRIMARY KEY, feedback_id integer NOT NULL REFERENCES feedback_items(id), actor_user_id integer NOT NULL REFERENCES users(id), event_type text NOT NULL, before_state jsonb, after_state jsonb, reason text, created_at timestamp NOT NULL DEFAULT now());
  CREATE TABLE feedback_transcription_jobs(id serial PRIMARY KEY, feedback_id integer NOT NULL REFERENCES feedback_items(id), asset_id integer NOT NULL REFERENCES feedback_assets(id), requested_by_id integer NOT NULL REFERENCES users(id), state text NOT NULL, adapter text NOT NULL, result text, error_code text, attempts integer NOT NULL, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now());
  CREATE TABLE fixture_failures(event_type text PRIMARY KEY);
  CREATE FUNCTION fixture_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS(SELECT 1 FROM fixture_failures WHERE event_type=NEW.event_type) THEN RAISE EXCEPTION 'fixture audit refusal'; END IF; RETURN NEW; END $$;
  CREATE TRIGGER fixture_reject_audit_trigger BEFORE INSERT ON feedback_audit_events FOR EACH ROW EXECUTE FUNCTION fixture_reject_audit();
  INSERT INTO companies VALUES (1,'A'),(2,'B'); INSERT INTO users VALUES (11,'a@test.invalid','A',1,false),(22,'b@test.invalid','B',2,false); INSERT INTO projects VALUES (101,'A project','A-1','active',11,now(),now()); INSERT INTO project_members(project_id,user_id,role,status) VALUES(101,11,'member','active');
`);

const app = express(); app.use(express.json()); app.use("/api/v1", router); const server = createServer(app); await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
const address = server.address(); if (!address || typeof address === "string") throw new Error("test server failed"); const base = `http://127.0.0.1:${address.port}/api/v1`;
const tokenA = signToken({ userId: 11, email: "a@test.invalid", companyId: 1, fullName: "A", companyName: "A" });
const tokenB = signToken({ userId: 22, email: "b@test.invalid", companyId: 2, fullName: "B", companyName: "B" });
const headers = (token: string, key?: string) => ({ "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(key ? { "Idempotency-Key": key } : {}) });
const body = { feedbackType: "bug", priority: "high", message: "Concurrent governed fixture", module: "Fixture", projectId: 101, pageUrl: "http://localhost/fixture", metadata: { userEmail: "must-not-persist@example.invalid", arbitrary: "must-not-persist", viewport: "390x844", language: "es" } };
try {
  await testPool.query("insert into fixture_failures values ('created')"); const rolledBack = await fetch(`${base}/feedback`, { method: "POST", headers: headers(tokenA, "rollback-key"), body: JSON.stringify(body) }); assert.equal(rolledBack.status, 500); assert.equal((await testPool.query("select count(*)::int n from feedback_items")).rows[0].n, 0); await testPool.query("delete from fixture_failures");
  const concurrent = await Promise.all(Array.from({ length: 4 }, () => fetch(`${base}/feedback`, { method: "POST", headers: headers(tokenA, "same-key"), body: JSON.stringify(body) })));
  assert.ok(concurrent.every(response => [200, 201].includes(response.status))); const payloads = await Promise.all(concurrent.map(response => response.json())); assert.equal(new Set(payloads.map(value => value.feedback.id)).size, 1);
  const count = await testPool.query("select count(*)::int n from feedback_items"); assert.equal(count.rows[0].n, 1); const audits = await testPool.query("select count(*)::int n from feedback_audit_events where event_type='created'"); assert.equal(audits.rows[0].n, 1);
  const divergent = await fetch(`${base}/feedback`, { method: "POST", headers: headers(tokenA, "same-key"), body: JSON.stringify({ ...body, message: "different" }) }); assert.equal(divergent.status, 409);
  const denied = await fetch(`${base}/feedback`, { method: "POST", headers: headers(tokenB, "cross-company"), body: JSON.stringify(body) }); assert.equal(denied.status, 403);
  const id = payloads[0].feedback.id; await testPool.query("update project_members set status='suspended' where user_id=11"); const suspended = await fetch(`${base}/feedback/${id}/history`, { headers: { Authorization: `Bearer ${tokenA}` } }); assert.equal(suspended.status, 403);
  await testPool.query("update project_members set status='active' where user_id=11"); const file = new FormData(); file.append("kind", "attachment"); file.append("files", new Blob(["bounded fixture"], { type: "text/plain" }), "field-note.txt"); const uploaded = await fetch(`${base}/feedback/${id}/assets`, { method: "POST", headers: { Authorization: `Bearer ${tokenA}` }, body: file }); assert.equal(uploaded.status, 201);
  const assetPayload = await uploaded.json(); assert.equal(assetPayload.assets[0].scanState, "quarantined"); const download = await fetch(`${base}/feedback/${id}/assets/${assetPayload.assets[0].id}/download`, { headers: { Authorization: `Bearer ${tokenA}` } }); assert.equal(download.status, 423);
  const duplicate = new FormData(); duplicate.append("kind", "attachment"); duplicate.append("files", new Blob(["bounded fixture"], { type: "text/plain" }), "field-note.txt"); const duplicateResponse = await fetch(`${base}/feedback/${id}/assets`, { method: "POST", headers: { Authorization: `Bearer ${tokenA}` }, body: duplicate }); assert.equal(duplicateResponse.status, 500); const assets = await testPool.query("select count(*)::int n from feedback_assets"); assert.equal(assets.rows[0].n, 1);
  const storedFiles = fs.existsSync(path.resolve("uploads")) ? fs.readdirSync(path.resolve("uploads", "projects", "101", "files")) : []; assert.equal(storedFiles.length, 1);
  console.log("feedback DB/HTTP contract: 16/16 passed");
} finally { await new Promise<void>(resolve => server.close(() => resolve())); await appPool.end(); await testPool.end(); }
