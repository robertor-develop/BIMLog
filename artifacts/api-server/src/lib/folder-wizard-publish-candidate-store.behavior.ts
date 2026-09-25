import assert from "node:assert/strict";
import { createFolderWizardPublishCandidateStore } from "./folder-wizard-publish-candidate-store";

let releaseCount = 0;
const calls: { sql: string; values?: unknown[] }[] = [];
const db = { connect: async () => ({
  query: async (sql: string, values?: unknown[]) => {
    calls.push({ sql, values });
    if (sql.includes("FROM projects p JOIN users creator")) return { rows: [{ company_id: 3 }] };
    if (sql.includes("FROM folder_wizard_current_imports c")) return { rows: [{ id: "import-1", source_text: "{}" }] };
    if (sql.includes("FROM folder_wizard_current_routing_profiles c") && sql.includes("c.scope_project_id=$2")) return { rows: [{ definition: {}, import_id: "import-1", scope_project_id: 5 }] };
    if (sql.includes("FROM sharepoint_project_mappings m")) return { rows: [{ state: "active", credential_state: "active", credential_id: "credential-1", site_id: "site-1", library_id: "drive-1" }] };
    if (sql.includes("FROM files WHERE")) return { rows: [{ id: 7, project_id: 5, file_name: "proof.txt", storage_path: "opaque", file_hash: "a".repeat(64), file_size_bytes: 9,
      status: "Active", is_compliant: true, is_superseded: false, cvr_workflow_status: "clean" }] };
    return { rows: [] };
  }, release: () => { releaseCount++; },
}) };
const store = createFolderWizardPublishCandidateStore(db as never, { verify: async () => ({ siteUrl: "https://bimtech.sharepoint.com/sites/QA", libraryId: "drive-1" }) });
const result = await store.read(5, 2, 7);
assert.equal(result.file?.status, "Active");
assert.equal(result.verifiedLibraryId, "drive-1");
assert.equal(releaseCount, 1);
assert.deepEqual(calls.find((call) => call.sql.includes("FROM files WHERE"))?.values, [7, 5]);
assert.match(calls[0].sql, /actor\.company_id=COALESCE/);
const offline = createFolderWizardPublishCandidateStore(db as never, { verify: async () => { throw new Error("offline"); } });
assert.equal((await offline.read(5, 2, 7)).verifiedLibraryId, null);
console.log("Folder Wizard candidate store scope and provider failure: PASS");
