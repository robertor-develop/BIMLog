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
  await pool.query(`INSERT INTO feedback_items(user_id,project_id,feedback_type,page_url,message,stable_id,company_id) VALUES(11,101,'bug','/fixture','preserve me','FB-TEST',1); INSERT INTO feedback_assets(feedback_id,project_id,uploaded_by_id,kind,original_name,safe_name,media_type,byte_size,sha256,storage_path,scan_state,scanned_at) VALUES(1,101,11,'attachment','a.txt','a.txt','text/plain',5,$1,'opaque','clean',now())`, [digest]);
  await ensureFeedbackSchema(pool); assert.equal((await pool.query(`SELECT message FROM feedback_items WHERE stable_id='FB-TEST'`)).rows[0].message, "preserve me");

  const insertJob = `INSERT INTO feedback_relay_jobs(feedback_id,asset_id,company_id,project_id,relay_mode,destination_id,object_id,idempotency_key,request_hash,source_byte_count,source_sha256,policy_id,policy_version,policy_sha256,lineage_id) VALUES(1,1,$1,$2,'queue','receiver','object','idem-1',$3,5,$3,'retention','approved-v1',$3,'lineage-1') RETURNING id`;
  await assert.rejects(() => pool.query(insertJob, [2,101,digest]), /company mismatch/);
  await assert.rejects(() => pool.query(insertJob, [1,202,digest]), /project mismatch/);
  await pool.query(`UPDATE feedback_items SET company_id=2 WHERE id=1`); await assert.rejects(() => pool.query(insertJob,[2,101,digest]),/canonical tenant authority mismatch/); assert.equal((await pool.query(`SELECT count(*)::int n FROM feedback_relay_jobs`)).rows[0].n,0); await pool.query(`UPDATE feedback_items SET company_id=1 WHERE id=1`);
  await pool.query(`CREATE OR REPLACE FUNCTION fixture_reject_created() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced custody failure'; END $$; CREATE TRIGGER fixture_reject_created BEFORE INSERT ON feedback_relay_custody_events FOR EACH ROW WHEN (NEW.event_type='created') EXECUTE FUNCTION fixture_reject_created()`);
  await assert.rejects(() => pool.query(insertJob, [1,101,digest]), /forced custody failure/); assert.equal((await pool.query(`SELECT count(*)::int n FROM feedback_relay_jobs`)).rows[0].n, 0);
  await pool.query(`DROP TRIGGER fixture_reject_created ON feedback_relay_custody_events`);
  const job = await pool.query(insertJob, [1,101,digest]); const jobId = job.rows[0].id; assert.equal((await pool.query(`SELECT count(*)::int n FROM feedback_relay_custody_events WHERE job_id=$1`,[jobId])).rows[0].n,1);
  await pool.query(`UPDATE feedback_relay_jobs SET lease_owner='worker-a',lease_token='lease-a',lease_expires_at=now()+interval '1 minute',fencing_token=1 WHERE id=$1`, [jobId]);
  const temporary = await pool.query(`INSERT INTO feedback_relay_temporary_objects(job_id,storage_backend,storage_key,byte_count,sha256,encrypted,expires_at) VALUES($1,'fixture','opaque-key',5,$2,true,now()+interval '1 day') RETURNING id`, [jobId,digest]); const temporaryId = temporary.rows[0].id;
  await assert.rejects(() => pool.query(`UPDATE feedback_relay_jobs SET lease_token='stale',fencing_token=0 WHERE id=$1`, [jobId]), /stale fencing/);
  await assert.rejects(() => pool.query(`UPDATE feedback_relay_jobs SET state='delivered',version=2 WHERE id=$1`, [jobId]), /direct lifecycle mutation denied/);
  await assert.rejects(() => pool.query(`INSERT INTO feedback_relay_custody_events(job_id,sequence,event_id,event_type,from_state,to_state,job_version,fencing_token,actor_type) VALUES($1,3,'event-gap','transfer','queued','queued',1,1,'system')`, [jobId]), /sequence mismatch/);
  await assert.rejects(() => pool.query(`UPDATE feedback_relay_custody_events SET event_type='changed' WHERE job_id=$1`, [jobId]), /immutable/);
  await pool.query(`INSERT INTO feedback_relay_nonces(job_id,receiver_id,direction,scope_id,company_id,project_id,feedback_id,asset_id,object_id,request_hash,audience,key_id,nonce,request_id,request_timestamp,expires_at) VALUES($1,'receiver','outbound','1:101',1,101,1,1,'object',$2,'receiver','key-1','nonce-1','request-1',now(),now()+interval '5 minutes')`,[jobId,digest]);
  await assert.rejects(() => pool.query(`INSERT INTO feedback_relay_nonces(job_id,receiver_id,direction,scope_id,company_id,project_id,feedback_id,asset_id,object_id,request_hash,audience,key_id,nonce,request_id,request_timestamp,expires_at) VALUES($1,'receiver','outbound','1:101',1,101,1,1,'object',$2,'receiver','key-2','nonce-1','request-2',now(),now()+interval '5 minutes')`,[jobId,digest]), /duplicate key/);
  await pool.query(`SELECT feedback_relay_transition_job($1,1,'lease-a',1,'transferring','event-2','transfer','worker','worker-a','claim')`,[jobId]);
  await pool.query(`SELECT feedback_relay_transition_job($1,2,'lease-a',1,'delivered','event-3','delivered','worker','worker-a','bytes-delivered')`,[jobId]);
  await assert.rejects(() => pool.query(`INSERT INTO feedback_relay_receipts(job_id,job_version,fencing_token,relay_mode,direction,company_id,project_id,feedback_id,asset_id,policy_id,policy_version,policy_sha256,request_hash,protocol_version,request_id,request_nonce,destination_id,object_id,byte_count,sha256,received_at,receiver_key_id,canonical_sha256,signature,verified_at,readback_verified_at,readback_sha256) VALUES($1,3,1,'queue','outbound',1,101,1,1,'retention','approved-v1',$2,$2,'1','direct','nonce','receiver','object',5,$2,now(),'key',$3,'sig',now(),now(),$2)`,[jobId,digest,canonical]), /direct insertion denied/);
  const receiptRace = await Promise.allSettled(["r1","r2"].map(requestId => pool.query(`SELECT feedback_relay_record_receipt($1,3,'lease-a',1,'1',$2,'nonce',now(),'receiver-key',$3,'signature',now(),now(),$4)`,[jobId,requestId,canonical,`receipt-${requestId}`]))); assert.equal(receiptRace.filter(v=>v.status==='fulfilled').length,1);
  const receiptId = (await pool.query(`SELECT receipt_id FROM feedback_relay_jobs WHERE id=$1`,[jobId])).rows[0].receipt_id;
  await assert.rejects(() => pool.query(`DELETE FROM feedback_relay_receipts WHERE id=$1`, [receiptId]), /immutable/);
  await pool.query(`SELECT feedback_relay_transition_job($1,4,'lease-a',1,'cleanup-pending','event-5','cleanup-pending','worker','worker-a','receipt-readback-complete')`,[jobId]);
  await pool.query(`INSERT INTO feedback_relay_holds(job_id,hold_key,reason,placed_by_user_id) VALUES($1,'legal','fixture hold',11)`, [jobId]);
  await assert.rejects(() => pool.query(`SELECT feedback_relay_mark_temporary_deleted($1,5,'lease-a',1,$2,now(),now(),now())`,[jobId,temporaryId]), /active hold/);
  await pool.query(`UPDATE feedback_relay_holds SET released_by_user_id=11,released_at=now(),release_reason='released' WHERE job_id=$1`, [jobId]);
  await pool.query(`SELECT feedback_relay_mark_temporary_deleted($1,5,'lease-a',1,$2,now(),now(),now())`,[jobId,temporaryId]);
  await assert.rejects(() => pool.query(`INSERT INTO feedback_relay_deletion_proofs(job_id,temporary_object_id,receipt_id,approval_id,approved_by_user_id,inventory,inventory_sha256,deleted_at,absence_verified_at,proof_sha256) SELECT $1,$2,$3,'direct',11,'{}',$4,deleted_at,absence_verified_at,$5 FROM feedback_relay_temporary_objects WHERE id=$2`,[jobId,temporaryId,receiptId,digest,proof]), /direct insertion denied/);
  const deletionRace=await Promise.allSettled(['d1','d2'].map(approval=>pool.query(`SELECT feedback_relay_record_deletion_proof($1,5,'lease-a',1,$2,$3,11,'{}',$4,$5,$6)`,[jobId,temporaryId,approval,digest,proof,`deletion-${approval}`]))); assert.equal(deletionRace.filter(v=>v.status==='fulfilled').length,1);
  await assert.rejects(() => pool.query(`UPDATE feedback_relay_deletion_proofs SET approval_id='changed' WHERE job_id=$1`, [jobId]), /immutable/);
  assert.equal((await pool.query(`SELECT count(*)::int n FROM feedback_relay_custody_events WHERE job_id=$1`,[jobId])).rows[0].n,6);
  console.log("feedback relay schema DB behavior: 24/24 passed");
} finally { await pool.end(); }
