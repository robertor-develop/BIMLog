import assert from "node:assert/strict";
import { createFolderWizardPublishJob } from "./folder-wizard-publish-job";
import { FolderWizardPublishQueue } from "./folder-wizard-publish-queue";

const plan = { requestDigest: "a".repeat(64), idempotencyKey: "a".repeat(64),
  driveRelativePath: "SHOP/proof.txt", filename: "proof.txt", sourceFileId: 8,
  sourceSha256: "b".repeat(64), sourceBytes: 16, importId: "import-1",
  profileFingerprint: "c".repeat(64), credentialId: "credential-1", siteId: "site-1",
  libraryId: "drive-1", siteUrl: "https://bimtech.sharepoint.com/sites/qa" };
const job = createFolderWizardPublishJob({ companyId: 3, projectId: 5, actorUserId: 2, plan, jobId: "job-0001" });
function database(mode: "new" | "repeat" | "conflict" | "denied") {
  const queries: string[] = [];
  let released = false;
  const client = { async query(sql: string, values?: unknown[]) {
    queries.push(sql);
    if (sql.includes("FROM projects p")) {
      assert.deepEqual(values?.slice(0, 4), [3, 5, 2, "credential-1"]);
      assert.match(sql, /folder_wizard_current_imports/);
      assert.match(sql, /sharepoint_project_mappings/);
      assert.match(sql, /f\.file_hash=\$7/);
      return { rows: [], rowCount: mode === "denied" ? 0 : 1 };
    }
    if (sql.includes("INSERT INTO connector_jobs")) return { rows: mode === "new" ? [{ id: job.id }] : [], rowCount: mode === "new" ? 1 : 0 };
    if (sql.includes("SELECT id,request_digest,payload")) return { rows: [{ id: job.id,
      request_digest: mode === "conflict" ? "d".repeat(64) : job.requestDigest,
      payload: { ...job.payload }, credential_id: job.credentialId }], rowCount: 1 };
    return { rows: [], rowCount: 1 };
  }, release() { released = true; } };
  return { pool: { connect: async () => client }, queries, isReleased: () => released };
}
for (const mode of ["new", "repeat", "conflict", "denied"] as const) {
  const fixture = database(mode);
  const queue = new FolderWizardPublishQueue(fixture.pool);
  if (mode === "conflict" || mode === "denied") await assert.rejects(queue.enqueue(job),
    mode === "conflict" ? /IDEMPOTENCY_CONFLICT/ : /SOURCE_STALE/);
  else assert.deepEqual(await queue.enqueue(job), { jobId: "job-0001", result: mode === "new" ? "queued" : "idempotent" });
  assert.equal(fixture.isReleased(), true);
  assert.equal(fixture.queries.at(-1), mode === "conflict" || mode === "denied" ? "ROLLBACK" : "COMMIT");
  assert.equal(fixture.queries.some((sql) => sql.includes("INSERT INTO connector_job_events")), mode === "new");
}
console.log("Folder Wizard transactional enqueue: PASS");
