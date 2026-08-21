import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
// @ts-expect-error Runtime dependency is installed; isolated proof does not require optional declarations.
import pg from "pg";

const urlText = process.env.BIMLOG_FEEDBACK_TEST_DATABASE_URL;
if (!urlText) throw new Error("BIMLOG_FEEDBACK_TEST_DATABASE_URL is required");
const parsed = new URL(urlText);
if (!["127.0.0.1", "localhost", "::1"].includes(parsed.hostname) || parsed.pathname !== "/bimlog_feedback_test" || parsed.search || parsed.hash) throw new Error("Backup DB proof requires exact loopback bimlog_feedback_test");
const root = path.resolve(".tmp", "feedback-backup-db-proof");
if (fs.existsSync(root)) { const stat = fs.lstatSync(root); if (!stat.isDirectory() || stat.isSymbolicLink() || path.basename(root) !== "feedback-backup-db-proof") throw new Error("FEEDBACK_BACKUP_PROOF_ROOT_INVALID"); fs.rmSync(root, { recursive: true }); }
process.env.NODE_ENV = "test"; process.env.PROD_DATABASE_URL = urlText; process.env.BIMLOG_FEEDBACK_STORAGE_BACKEND = "local-test"; process.env.BIMLOG_FEEDBACK_UPLOAD_ROOT = root;
process.env.BIMLOG_FEEDBACK_BACKUP_BACKEND = "replit-app-storage"; process.env.BIMLOG_FEEDBACK_BACKUP_BUCKET_ID = "backup-db-proof-bucket"; process.env.BIMLOG_FEEDBACK_BACKUP_BACKEND_ID = "backup-db-proof"; process.env.BIMLOG_FEEDBACK_BACKUP_KEY_ID = "backup-db-proof-key-v1"; process.env.BIMLOG_FEEDBACK_BACKUP_KEY_B64 = Buffer.alloc(32, 91).toString("base64");

const { ensureFeedbackSchema } = await import("./feedback-schema-migration");
const { storage } = await import("./storage-adapter");
const { createFeedbackBackupAuthorityFromEnvironment, __setFeedbackBackupAuthorityForTest, processFeedbackBackupBatch, feedbackBackupProgress } = await import("./feedback-backup-worker");
const { pool: appPool } = await import("@workspace/db");
const testPool = new pg.Pool({ connectionString: urlText });
const objects = new Map<string, Buffer>(); let failWrites = false;
const objectClient = {
  async uploadFromBytes(name: string, bytes: Buffer) { if (failWrites) return { ok: false as const, error: new Error("forced") }; objects.set(name, Buffer.from(bytes)); return { ok: true as const, value: null }; },
  downloadAsStream(name: string) { const value = objects.get(name); return value ? Readable.from([value]) : Readable.from((async function*(){ throw new Error("missing"); })()); },
  async delete(name: string) { objects.delete(name); return { ok: true as const, value: null }; },
};

async function reset() {
  await testPool.query(`DROP TABLE IF EXISTS feedback_relay_purge_key_authorities,feedback_relay_purge_commands,feedback_relay_deletion_proofs,feedback_relay_temporary_objects,feedback_relay_holds,feedback_relay_receipts,feedback_relay_nonces,feedback_relay_custody_events,feedback_relay_jobs CASCADE`);
  await testPool.query(`DROP TABLE IF EXISTS feedback_backup_jobs,feedback_transcription_jobs,feedback_capture_consents,feedback_audit_events,feedback_assets,feedback_items,project_members,projects,users,companies`);
  await testPool.query(`CREATE TABLE companies(id integer PRIMARY KEY,name text NOT NULL); CREATE TABLE users(id integer PRIMARY KEY,email text NOT NULL,full_name text NOT NULL,company_id integer NOT NULL REFERENCES companies(id),is_super_admin boolean NOT NULL DEFAULT false); CREATE TABLE projects(id integer PRIMARY KEY,name text NOT NULL,code text NOT NULL,status text NOT NULL,created_by_id integer NOT NULL REFERENCES users(id),created_at timestamp NOT NULL DEFAULT now(),updated_at timestamp NOT NULL DEFAULT now()); CREATE TABLE project_members(id serial PRIMARY KEY,project_id integer NOT NULL REFERENCES projects(id),user_id integer NOT NULL REFERENCES users(id),role text NOT NULL,status text NOT NULL DEFAULT 'active',permissions_override jsonb); INSERT INTO companies VALUES(1,'A'); INSERT INTO users VALUES(11,'a@test.invalid','A',1,true); INSERT INTO projects VALUES(101,'A','A-1','active',11,now(),now()); INSERT INTO project_members(project_id,user_id,role,status) VALUES(101,11,'retention_officer','active')`);
  await ensureFeedbackSchema(testPool);
}

try {
  await reset();
  const authority = createFeedbackBackupAuthorityFromEnvironment(process.env, objectClient); assert.ok(authority); __setFeedbackBackupAuthorityForTest(authority!);
  await testPool.query(`INSERT INTO feedback_items(user_id,project_id,feedback_type,page_url,message,stable_id,company_id) VALUES(11,101,'bug','/proof','proof','FB-BACKUP-1',1)`);
  const source = Buffer.from("exact durable source"), storagePath = await storage.upload(source, 101, "proof.bin"), sha256 = (await import("node:crypto")).createHash("sha256").update(source).digest("hex");
  const inserted = await testPool.query(`INSERT INTO feedback_assets(feedback_id,project_id,uploaded_by_id,kind,original_name,safe_name,media_type,byte_size,sha256,storage_path,scan_state,scanned_at) VALUES(1,101,11,'attachment','proof.bin','proof.bin','application/octet-stream',$1,$2,$3,'clean',now()) RETURNING id`, [source.length, sha256, storagePath]);
  const assetId = inserted.rows[0].id; assert.equal((await testPool.query(`SELECT count(*)::int n FROM feedback_backup_jobs WHERE asset_id=$1 AND state='queued'`, [assetId])).rows[0].n, 1, "insert trigger must enroll exactly once");
  const result = await processFeedbackBackupBatch(2); assert.deepEqual(result, { attempted: 1, verified: 1, failed: 0, manualReview: 0 });
  const verified = (await testPool.query(`SELECT * FROM feedback_backup_jobs WHERE asset_id=$1`, [assetId])).rows[0]; assert.equal(verified.state, "verified"); assert.equal(verified.source_sha256, sha256); assert.match(verified.ciphertext_sha256, /^[a-f0-9]{64}$/); assert.equal(verified.lease_owner, null); assert.equal((await testPool.query(`SELECT count(*)::int n FROM feedback_audit_events WHERE event_type='evidence_backup_verified'`)).rows[0].n, 1);

  await testPool.query(`INSERT INTO feedback_items(user_id,project_id,feedback_type,page_url,message,stable_id,company_id) VALUES(11,101,'bug','/proof','failure','FB-BACKUP-2',1)`);
  const secondPath = await storage.upload(source, 101, "failure.bin"); await testPool.query(`INSERT INTO feedback_assets(feedback_id,project_id,uploaded_by_id,kind,original_name,safe_name,media_type,byte_size,sha256,storage_path,scan_state,scanned_at) VALUES(2,101,11,'attachment','failure.bin','failure.bin','application/octet-stream',$1,$2,$3,'clean',now())`, [source.length, sha256, secondPath]);
  failWrites = true; const failed = await processFeedbackBackupBatch(1); assert.deepEqual(failed, { attempted: 1, verified: 0, failed: 1, manualReview: 0 });
  const retry = (await testPool.query(`SELECT state,attempts,next_attempt_at,lease_owner,last_error_code FROM feedback_backup_jobs WHERE feedback_id=2`)).rows[0]; assert.equal(retry.state, "retry-required"); assert.equal(retry.attempts, 1); assert.ok(retry.next_attempt_at); assert.equal(retry.lease_owner, null); assert.equal(retry.last_error_code, "FEEDBACK_BACKUP_OBJECT_WRITE_FAILED");
  const progress = await feedbackBackupProgress(); assert.equal(progress.configured, true); assert.equal(progress.verified, 1); assert.equal(progress.deferred, 1);
  process.stdout.write("feedback backup PostgreSQL lifecycle: 12/12 passed\n");
} finally {
  __setFeedbackBackupAuthorityForTest(undefined); await appPool.end(); await testPool.end();
  if (fs.existsSync(root)) { const stat = fs.lstatSync(root); if (stat.isDirectory() && !stat.isSymbolicLink() && path.basename(root) === "feedback-backup-db-proof") fs.rmSync(root, { recursive: true }); }
}
