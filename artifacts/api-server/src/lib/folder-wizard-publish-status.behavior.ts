import assert from "node:assert/strict";
import { FolderWizardPublishStatusStore } from "./folder-wizard-publish-status";

const queries: string[] = [];
const client = { query: async (sql: string, values?: unknown[]) => {
  queries.push(sql);
  if (sql.includes("FROM projects p")) return { rows: [{ company_id: 3 }] };
  assert.deepEqual(values, [3, 5]);
  return { rows: [{ id: "job-1", state: "retry", attempts: 2, max_attempts: 5,
    last_error_code: "FOLDER_WIZARD_GRAPH_UPLOAD_FAILED", filename: "proof.txt", source_file_id: "7",
    created_at: new Date("2026-09-25T00:00:00Z"), updated_at: "2026-09-25T00:01:00Z",
    next_attempt_at: new Date("2026-09-25T00:02:00Z"),
    completed_at: null, dead_lettered_at: null, payload: { secret: "must-not-leak" } }] };
}, release: () => {} };
const store = new FolderWizardPublishStatusStore({ connect: async () => client as never });
const result = await store.list({ projectId: 5, actorUserId: 2 });
assert.equal(result[0]?.jobId, "job-1");
assert.equal(result[0]?.state, "retry");
assert.equal(result[0]?.sourceFileId, 7);
assert.equal(result[0]?.createdAt, "2026-09-25T00:00:00.000Z");
assert.equal(result[0]?.nextAttemptAt, "2026-09-25T00:02:00.000Z");
assert.equal(result[0]?.completedAt, null);
assert.doesNotMatch(JSON.stringify(result), /must-not-leak|secret|credential|token/i);
assert.match(queries[1] ?? "", /company_id=\$1 AND project_id=\$2/);
assert.match(queries[1] ?? "", /LIMIT 25/);
console.log("Folder Wizard scoped publish status: PASS");
for (const state of ["completed", "retry", "dead_letter", "cancelled", "leased", "queued", undefined]) {
  let released = false;
  const scoped = new FolderWizardPublishStatusStore({ connect: async () => ({
    query: async (sql: string, values?: unknown[]) => {
      if (sql.includes("FROM projects p")) return { rows: [{ company_id: 3 }] };
      assert.deepEqual(values, [3, 5, "job-1"]);
      assert.match(sql, /company_id=\$1 AND project_id=\$2 AND id=\$3/);
      assert.match(sql, /payload->>'kind'='folder_wizard_file_v1'/);
      return { rows: state ? [{ state }] : [] };
    }, release: () => { released = true; },
  }) });
  assert.equal(await scoped.executionState({ projectId: 5, actorUserId: 2 }, "job-1"),
    ["completed", "retry", "dead_letter", "cancelled"].includes(state ?? "") ? state : "not_due_or_already_claimed");
  assert.equal(released, true);
}
