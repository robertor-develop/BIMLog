import assert from "node:assert/strict";
import { FolderWizardPublishStatusStore } from "./folder-wizard-publish-status";

const queries: string[] = [];
const client = { query: async (sql: string, values?: unknown[]) => {
  queries.push(sql);
  if (sql.includes("FROM projects p")) return { rows: [{ company_id: 3 }] };
  assert.deepEqual(values, [3, 5]);
  return { rows: [{ id: "job-1", state: "retry", attempts: 2, max_attempts: 5,
    last_error_code: "FOLDER_WIZARD_GRAPH_UPLOAD_FAILED", filename: "proof.txt", source_file_id: "7",
    created_at: "2026-09-25T00:00:00Z", updated_at: "2026-09-25T00:01:00Z",
    completed_at: null, dead_lettered_at: null, payload: { secret: "must-not-leak" } }] };
}, release: () => {} };
const store = new FolderWizardPublishStatusStore({ connect: async () => client as never });
const result = await store.list({ projectId: 5, actorUserId: 2 });
assert.equal(result[0]?.jobId, "job-1");
assert.equal(result[0]?.state, "retry");
assert.equal(result[0]?.sourceFileId, 7);
assert.doesNotMatch(JSON.stringify(result), /must-not-leak|secret|credential|token/i);
assert.match(queries[1] ?? "", /company_id=\$1 AND project_id=\$2/);
assert.match(queries[1] ?? "", /LIMIT 25/);
console.log("Folder Wizard scoped publish status: PASS");
