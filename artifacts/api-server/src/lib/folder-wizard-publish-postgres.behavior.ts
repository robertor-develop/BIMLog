import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
// @ts-expect-error Runtime pg dependency is installed; isolated SQL proof does not require optional declarations.
import pg from "pg";
import { createFolderWizardPublishJob } from "./folder-wizard-publish-job";
import { FolderWizardPublishQueue } from "./folder-wizard-publish-queue";
import { FolderWizardPublishLeaseStore } from "./folder-wizard-publish-lease";
import { FolderWizardPublishSettlement } from "./folder-wizard-publish-settlement";
import { createFolderWizardDestinationStore } from "./folder-wizard-destination";

const rawUrl = process.env.BIMLOG_FOLDER_WIZARD_TEST_DATABASE_URL;
if (!rawUrl) throw new Error("FOLDER_WIZARD_TEST_DATABASE_REQUIRED");
const url = new URL(rawUrl);
if (url.hostname !== "127.0.0.1" || url.pathname !== "/bimlog_rfi_test")
  throw new Error("FOLDER_WIZARD_TEST_DATABASE_MUST_BE_DISPOSABLE_LOCALHOST");

const actualPool = new pg.Pool({ connectionString: rawUrl, max: 1 });
const client = await actualPool.connect();
await client.query("BEGIN");
// Every production operation still executes against PostgreSQL, while savepoints keep
// immutable audit evidence and all synthetic records inside one disposable transaction.
const pool = {
  query: (sql: string, values?: unknown[]) => client.query(sql, values),
  connect: async () => ({
    query: async (sql: string, values?: unknown[]) => {
      if (sql === "BEGIN") return client.query("SAVEPOINT wizard_operation");
      if (sql === "COMMIT") return client.query("RELEASE SAVEPOINT wizard_operation");
      if (sql === "ROLLBACK") {
        await client.query("ROLLBACK TO SAVEPOINT wizard_operation");
        return client.query("RELEASE SAVEPOINT wizard_operation");
      }
      return client.query(sql, values);
    },
    release: () => {},
  }),
};
const suffix = randomUUID();
const id = (prefix: string) => `${prefix}-${suffix}`;
let companyId = 0;
let userId = 0;
let projectId = 0;
let fileId = 0;
const jobId = randomUUID();
const digest = "a".repeat(64);
try {
  companyId = Number((await pool.query("INSERT INTO companies(name) VALUES($1) RETURNING id", [id("wizard-company")])).rows[0].id);
  userId = Number((await pool.query(`INSERT INTO users(email,password_hash,full_name,company_id,is_super_admin)
    VALUES($1,$2,$3,$4,false) RETURNING id`, [`${suffix}@invalid.test`, "synthetic-inert-hash", "Wizard Test", companyId])).rows[0].id);
  projectId = Number((await pool.query(`INSERT INTO projects(name,code,status,created_by_id)
    VALUES($1,$2,'active',$3) RETURNING id`, [id("wizard-project"), id("WIZ"), userId])).rows[0].id);
  await pool.query("INSERT INTO project_members(project_id,user_id,role) VALUES($1,$2,'project_admin')", [projectId, userId]);
  await pool.query(`INSERT INTO connector_credentials(id,company_id,provider,label,state,secret_ciphertext,secret_iv,
    secret_tag,wrapped_data_key,wrap_iv,wrap_tag,key_version,created_by_id)
    VALUES($1,$2,'sharepoint',$3,'active','synthetic','synthetic','synthetic','synthetic','synthetic','synthetic',1,$4)`,
    [id("credential"), companyId, id("Wizard Test"), userId]);
  const destinations = createFolderWizardDestinationStore(pool as never, { async verify(input) {
    assert.equal(input.companyId, companyId);
    return { siteUrl: "https://test.sharepoint.com/sites/qa", libraryId: input.libraryId };
  } });
  const destinationScope = { projectId, actorUserId: userId };
  const destinationInput = { credentialId: id("credential"), siteId: "site-test", libraryId: "library-test", confirmation: "configure_sharepoint_destination" };
  assert.equal((await destinations.read(destinationScope)).current, null);
  assert.equal((await destinations.create(destinationScope, destinationInput)).result, "created");
  assert.equal((await destinations.create(destinationScope, destinationInput)).result, "idempotent");
  await assert.rejects(destinations.create(destinationScope, { ...destinationInput, libraryId: "different-library" }), /CONFLICT/);
  assert.equal((await destinations.read(destinationScope)).current?.libraryId, "library-test");
  assert.equal(Number((await pool.query("SELECT count(*) FROM admin_actions_log WHERE action='sharepoint_destination_configured' AND target_id=$1", [String(projectId)])).rows[0].count), 1);
  await pool.query(`INSERT INTO folder_wizard_imports(id,company_id,project_id,version,source_sha256,source_text,imported_by_id)
    VALUES($1,$2,$3,1,$4,'{}',$5)`, [id("import"), companyId, projectId, digest, userId]);
  await pool.query(`INSERT INTO folder_wizard_current_imports(project_id,company_id,import_id,designated_by_id)
    VALUES($1,$2,$3,$4)`, [projectId, companyId, id("import"), userId]);
  await pool.query(`INSERT INTO folder_wizard_routing_profiles(id,company_id,version,definition,fingerprint,created_by_id)
    VALUES($1,$2,1,'{}'::jsonb,$3,$4)`, [id("profile"), companyId, digest, userId]);
  await pool.query(`INSERT INTO folder_wizard_current_routing_profiles(id,company_id,profile_id,designated_by_id)
    VALUES($1,$2,$3,$4)`, [id("current-profile"), companyId, id("profile"), userId]);
  fileId = Number((await pool.query(`INSERT INTO files(project_id,file_name,file_size,file_type,status,uploaded_by_id,
    file_hash,file_size_bytes,is_compliant,is_superseded)
    VALUES($1,'proof.txt',5,'text/plain','active',$2,$3,5,true,false) RETURNING id`, [projectId, userId, digest])).rows[0].id);

  const job = createFolderWizardPublishJob({ companyId, projectId, actorUserId: userId, jobId,
    plan: { requestDigest: digest, idempotencyKey: digest, driveRelativePath: "SHOP/proof.txt",
      filename: "proof.txt", tags: {}, sourceFileId: fileId, sourceSha256: digest, sourceBytes: 5,
      importId: id("import"), profileFingerprint: digest, credentialId: id("credential"),
      siteId: "site-test", libraryId: "library-test", siteUrl: "https://test.sharepoint.com/sites/qa" } });
  const queue = new FolderWizardPublishQueue(pool as never);
  assert.deepEqual(await queue.enqueue(job), { jobId, result: "queued" });
  assert.deepEqual(await queue.enqueue(job), { jobId, result: "idempotent" });
  await assert.rejects(queue.enqueue({ ...job, payload: { ...job.payload, tags: { changed: "yes" } } }),
    /FOLDER_WIZARD_JOB_IDEMPOTENCY_CONFLICT/);
  const leaseStore = new FolderWizardPublishLeaseStore(pool as never);
  const settlement = new FolderWizardPublishSettlement(pool as never);
  assert.equal(await leaseStore.claim("wizard-test-worker", id("different-job")), null);
  const first = await leaseStore.claim("wizard-test-worker", jobId);
  assert.equal(first?.jobId, jobId);
  assert.equal(first?.fencingToken, 1);
  assert.equal(await settlement.settle(first!, { kind: "failed", code: "FOLDER_WIZARD_GRAPH_UPLOAD_FAILED", retryable: true }), "retry");
  await assert.rejects(settlement.settle(first!, { kind: "completed", itemId: "stale" }), /FOLDER_WIZARD_LEASE_STALE/);
  await pool.query("UPDATE connector_jobs SET next_attempt_at=now() WHERE id=$1", [jobId]);
  const second = await leaseStore.claim("wizard-test-worker", jobId);
  assert.equal(second?.fencingToken, 2);
  assert.equal(await settlement.settle(second!, { kind: "completed", itemId: "synthetic-item" }), "completed");
  assert.equal(await leaseStore.claim("wizard-test-worker"), null);
  const events = (await pool.query("SELECT sequence,event_type,to_state FROM connector_job_events WHERE job_id=$1 ORDER BY sequence", [jobId])).rows;
  assert.deepEqual(events.map((event: { sequence: number; event_type: string; to_state: string }) => [event.sequence, event.event_type, event.to_state]),
    [[1, "queued", "queued"], [2, "leased", "leased"], [3, "retry", "retry"], [4, "leased", "leased"], [5, "completed", "completed"]]);
  console.log("Folder Wizard real PostgreSQL queue/lease/retry/settlement: PASS");
} finally {
  await client.query("ROLLBACK");
  client.release();
  await actualPool.end();
}
