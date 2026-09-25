import assert from "node:assert/strict";
import { CLAIM_FOLDER_WIZARD_PUBLISH_SQL, FolderWizardPublishLeaseStore } from "./folder-wizard-publish-lease";

assert.match(CLAIM_FOLDER_WIZARD_PUBLISH_SQL, /FOR UPDATE SKIP LOCKED/);
assert.match(CLAIM_FOLDER_WIZARD_PUBLISH_SQL, /payload->>'kind'='folder_wizard_file_v1'/);
assert.match(CLAIM_FOLDER_WIZARD_PUBLISH_SQL, /lease_expires_at<now\(\)/);
assert.match(CLAIM_FOLDER_WIZARD_PUBLISH_SQL, /fencing_token=j\.fencing_token\+1/);
for (const withJob of [false, true]) {
  const statements: string[] = [];
  let released = false;
  const database = { connect: async () => ({ query: async (sql: string) => {
    statements.push(sql);
    if (sql === CLAIM_FOLDER_WIZARD_PUBLISH_SQL) return { rows: withJob ? [{ id: "job-1", company_id: 3,
      project_id: 5, credential_id: "credential-1", created_by_id: 2, request_digest: "a".repeat(64), fencing_token: 2, attempts: 2,
      previous_state: "leased", payload: { kind: "folder_wizard_file_v1" } }] : [], rowCount: withJob ? 1 : 0 };
    return { rows: [], rowCount: 1 };
  }, release: () => { released = true; } }) };
  const result = await new FolderWizardPublishLeaseStore(database).claim("worker-1");
  assert.equal(result?.fencingToken ?? null, withJob ? 2 : null);
  assert.equal(statements.at(-1), "COMMIT");
  assert.equal(statements.some((sql) => sql.includes("INSERT INTO connector_job_events")), withJob);
  assert.equal(released, true);
}
console.log("Folder Wizard fenced lease claim: PASS");
