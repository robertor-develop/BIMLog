import assert from "node:assert/strict";
// @ts-expect-error Runtime dependency is installed; this isolated harness does not need optional declarations.
import pg from "pg";
import { ensureFeedbackSchema, FEEDBACK_SCHEMA_ADVISORY_LOCK } from "./feedback-schema-migration";

const urlText = process.env.BIMLOG_FEEDBACK_TEST_DATABASE_URL;
if (!urlText) throw new Error("BIMLOG_FEEDBACK_TEST_DATABASE_URL is required");
const parsed = new URL(urlText);
if (!["127.0.0.1", "localhost", "::1"].includes(parsed.hostname) || parsed.pathname !== "/bimlog_feedback_test" || parsed.search || parsed.hash) throw new Error("Relay schema test DB must be exact loopback-only bimlog_feedback_test");
const pool = new pg.Pool({ connectionString: urlText });
const digest = "a".repeat(64), canonical = "b".repeat(64), proof = "c".repeat(64);

try {
  await pool.query(`DROP TABLE IF EXISTS feedback_relay_deletion_proofs,feedback_relay_temporary_objects,feedback_relay_holds,feedback_relay_receipts,feedback_relay_nonces,feedback_relay_custody_events,feedback_relay_jobs,feedback_transcription_jobs,feedback_capture_consents,feedback_audit_events,feedback_assets,feedback_items,project_members,projects,users,companies CASCADE`);
  await pool.query(`CREATE TABLE companies(id integer PRIMARY KEY,name text NOT NULL); CREATE TABLE users(id integer PRIMARY KEY,email text NOT NULL,full_name text NOT NULL,company_id integer NOT NULL REFERENCES companies(id)); CREATE TABLE projects(id integer PRIMARY KEY,name text NOT NULL,code text NOT NULL,status text NOT NULL,created_by_id integer NOT NULL REFERENCES users(id),created_at timestamp NOT NULL DEFAULT now(),updated_at timestamp NOT NULL DEFAULT now()); INSERT INTO companies VALUES(1,'A'),(2,'B'); INSERT INTO users VALUES(11,'a@test.invalid','A',1),(22,'b@test.invalid','B',2); INSERT INTO projects VALUES(101,'A project','A-1','active',11,now(),now()),(202,'B project','B-1','active',22,now(),now()); CREATE VIEW feedback_relay_nonces AS SELECT 1::bigint id`);
  await assert.rejects(() => ensureFeedbackSchema(pool));
  assert.equal((await pool.query(`SELECT to_regclass('feedback_relay_jobs') value`)).rows[0].value, null, "failed migration must leave no created relay tables");
  await pool.query(`DROP VIEW feedback_relay_nonces`);

  const owner = await pool.connect(); await owner.query("BEGIN"); await owner.query(`SELECT pg_advisory_xact_lock(${FEEDBACK_SCHEMA_ADVISORY_LOCK})`);
  let settled = false; const blocked = ensureFeedbackSchema(pool).finally(() => { settled = true; }); await new Promise(resolve => setTimeout(resolve, 100)); assert.equal(settled, false); await owner.query("COMMIT"); owner.release(); await blocked;
  await pool.query(`INSERT INTO feedback_items(user_id,project_id,feedback_type,page_url,message,stable_id,company_id) VALUES(11,101,'bug','/fixture','preserve me','FB-TEST',1); INSERT INTO feedback_assets(feedback_id,project_id,uploaded_by_id,kind,original_name,safe_name,media_type,byte_size,sha256,storage_path,scan_state) VALUES(1,101,11,'attachment','a.txt','a.txt','text/plain',5,$1,'opaque','clean')`, [digest]);
  await ensureFeedbackSchema(pool); assert.equal((await pool.query(`SELECT message FROM feedback_items WHERE stable_id='FB-TEST'`)).rows[0].message, "preserve me");

  await assert.rejects(() => pool.query(`INSERT INTO feedback_relay_jobs(feedback_id,asset_id,company_id,project_id,destination_id,object_id,policy_id,policy_version,policy_sha256) VALUES(1,1,2,101,'receiver','object','policy','1',$1)`, [digest]), /company mismatch/);
  await assert.rejects(() => pool.query(`INSERT INTO feedback_relay_jobs(feedback_id,asset_id,company_id,project_id,destination_id,object_id,policy_id,policy_version,policy_sha256) VALUES(1,1,1,202,'receiver','object','policy','1',$1)`, [digest]), /project mismatch/);
  const job = await pool.query(`INSERT INTO feedback_relay_jobs(feedback_id,asset_id,company_id,project_id,destination_id,object_id,policy_id,policy_version,policy_sha256) VALUES(1,1,1,101,'receiver','object','retention','approved-v1',$1) RETURNING id`, [digest]); const jobId = job.rows[0].id;
  await pool.query(`UPDATE feedback_relay_jobs SET lease_owner='worker-a',lease_token='lease-a',lease_expires_at=now()+interval '1 minute',fencing_token=1 WHERE id=$1`, [jobId]);
  await assert.rejects(() => pool.query(`UPDATE feedback_relay_jobs SET lease_token='stale',fencing_token=0 WHERE id=$1`, [jobId]), /stale fencing/);
  await pool.query(`INSERT INTO feedback_relay_custody_events(job_id,sequence,event_id,event_type,from_state,to_state,job_version,fencing_token,actor_type) VALUES($1,1,'event-1','queued',NULL,'queued',1,1,'system')`, [jobId]);
  await assert.rejects(() => pool.query(`INSERT INTO feedback_relay_custody_events(job_id,sequence,event_id,event_type,from_state,to_state,job_version,fencing_token,actor_type) VALUES($1,3,'event-gap','transfer','queued','queued',1,1,'system')`, [jobId]), /sequence mismatch/);
  await assert.rejects(() => pool.query(`UPDATE feedback_relay_custody_events SET event_type='changed' WHERE job_id=$1`, [jobId]), /immutable/);

  await pool.query(`INSERT INTO feedback_relay_nonces(audience,key_id,nonce,request_id,request_timestamp,expires_at) VALUES('receiver','key-1','nonce-1','request-1',now(),now()+interval '5 minutes')`);
  await assert.rejects(() => pool.query(`INSERT INTO feedback_relay_nonces(audience,key_id,nonce,request_id,request_timestamp,expires_at) VALUES('receiver','key-1','nonce-1','request-2',now(),now()+interval '5 minutes')`), /duplicate key/);
  await pool.query(`UPDATE feedback_relay_jobs SET state='delivered',version=2 WHERE id=$1`, [jobId]);
  await pool.query(`INSERT INTO feedback_relay_custody_events(job_id,sequence,event_id,event_type,from_state,to_state,job_version,fencing_token,actor_type) VALUES($1,2,'event-2','delivered','queued','delivered',2,1,'system')`, [jobId]);
  const receipt = await pool.query(`INSERT INTO feedback_relay_receipts(job_id,protocol_version,request_id,request_nonce,destination_id,object_id,byte_count,sha256,received_at,receiver_key_id,canonical_sha256,signature,verified_at,readback_verified_at,readback_sha256) VALUES($1,'1','delivery-1','nonce-delivery','receiver','object',5,$2,now(),'receiver-key',$3,'signature',now(),now(),$2) RETURNING id`, [jobId,digest,canonical]); const receiptId = receipt.rows[0].id;
  await assert.rejects(() => pool.query(`DELETE FROM feedback_relay_receipts WHERE id=$1`, [receiptId]), /immutable/);
  const temporary = await pool.query(`INSERT INTO feedback_relay_temporary_objects(job_id,storage_backend,storage_key,byte_count,sha256,encrypted,expires_at) VALUES($1,'fixture','opaque-key',5,$2,true,now()+interval '1 day') RETURNING id`, [jobId,digest]); const temporaryId = temporary.rows[0].id;
  await pool.query(`INSERT INTO feedback_relay_holds(job_id,hold_key,reason,placed_by_user_id) VALUES($1,'legal','fixture hold',11)`, [jobId]);
  await pool.query(`UPDATE feedback_relay_temporary_objects SET delete_started_at=now(),deleted_at=now(),absence_verified_at=now(),delete_fencing_token=1 WHERE id=$1`, [temporaryId]);
  await assert.rejects(() => pool.query(`INSERT INTO feedback_relay_deletion_proofs(job_id,temporary_object_id,receipt_id,approval_id,approved_by_user_id,inventory,inventory_sha256,deleted_at,absence_verified_at,proof_sha256) SELECT $1,$2,$3,'approval',11,'{}',$4,deleted_at,absence_verified_at,$5 FROM feedback_relay_temporary_objects WHERE id=$2`, [jobId,temporaryId,receiptId,digest,proof]), /active hold/);
  await pool.query(`UPDATE feedback_relay_holds SET released_by_user_id=11,released_at=now(),release_reason='released' WHERE job_id=$1`, [jobId]);
  await pool.query(`INSERT INTO feedback_relay_deletion_proofs(job_id,temporary_object_id,receipt_id,approval_id,approved_by_user_id,inventory,inventory_sha256,deleted_at,absence_verified_at,proof_sha256) SELECT $1,$2,$3,'approval',11,'{}',$4,deleted_at,absence_verified_at,$5 FROM feedback_relay_temporary_objects WHERE id=$2`, [jobId,temporaryId,receiptId,digest,proof]);
  await assert.rejects(() => pool.query(`UPDATE feedback_relay_deletion_proofs SET approval_id='changed' WHERE job_id=$1`, [jobId]), /immutable/);
  console.log("feedback relay schema DB behavior: 16/16 passed");
} finally { await pool.end(); }
