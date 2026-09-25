import assert from "node:assert/strict";
import { FolderWizardPublishSettlement } from "./folder-wizard-publish-settlement";
import type { FolderWizardLease } from "./folder-wizard-publish-lease";

const lease: FolderWizardLease = { jobId: "job-1", companyId: 3, projectId: 5, credentialId: "credential-1",
  leaseOwner: "worker-1", leaseToken: "11111111-1111-4111-8111-111111111111", fencingToken: 2,
  attempts: 2, payload: { kind: "folder_wizard_file_v1" } };
for (const [outcome, maxAttempts, expected] of [
  [{ kind: "completed", itemId: "item-1" }, 5, "completed"],
  [{ kind: "failed", code: "FOLDER_WIZARD_PROVIDER_RETRY", retryable: true }, 5, "retry"],
  [{ kind: "failed", code: "FOLDER_WIZARD_PROVIDER_RETRY", retryable: true }, 2, "dead_letter"],
  [{ kind: "failed", code: "FOLDER_WIZARD_GRAPH_FILE_EXISTS", retryable: false }, 5, "dead_letter"],
] as const) {
  const statements: string[] = [];
  const database = { connect: async () => ({ query: async (sql: string, values?: unknown[]) => {
    statements.push(sql);
    if (sql.includes("FROM connector_jobs WHERE id=$1")) return { rows: [{ attempts: 2, max_attempts: maxAttempts }], rowCount: 1 };
    if (sql.includes("UPDATE connector_jobs")) assert.equal(values?.[6], expected);
    return { rows: [], rowCount: 1 };
  }, release: () => {} }) };
  assert.equal(await new FolderWizardPublishSettlement(database).settle(lease, outcome), expected);
  assert.equal(statements.at(-1), "COMMIT");
  assert.equal(statements.some((sql) => sql.includes("INSERT INTO connector_job_events")), true);
}
const denied = { connect: async () => ({ query: async (sql: string) => ({ rows: sql.includes("FROM connector_jobs WHERE id=$1") ? [] : [], rowCount: 1 }), release: () => {} }) };
await assert.rejects(new FolderWizardPublishSettlement(denied).settle(lease, { kind: "completed", itemId: "item-1" }), /LEASE_STALE/);
console.log("Folder Wizard fenced publish settlement: PASS");
