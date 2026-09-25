import assert from "node:assert/strict";
import { createFolderWizardPublishReadinessStore } from "./folder-wizard-publish-readiness-store";

let allowed = true;
let configured = false;
const statements: string[] = [];
const client = { release() {}, async query(sql: string) {
  statements.push(sql);
  if (sql.includes("FROM projects p JOIN users creator")) return { rows: allowed ? [{ company_id: 2 }] : [] };
  if (configured && sql.includes("FROM folder_wizard_current_imports c")) return { rows: [{ id: "import-1", source_text: JSON.stringify({
    generated_by: "BT Folder Wizard", version: "3.1 (BIMLOG export)", destination: { sharepoint_url: "https://bimtech.sharepoint.com/sites/QA", base_path: "" },
    blueprints: [{ name: "Test", include: true, tiers: [{ label: "TYPE", items: ["SHOP"], mode: "none", start: 0, width: 0, sep: "_", case: "upper" }] }],
  }) }] };
  if (configured && sql.includes("FROM folder_wizard_current_routing_profiles c") && sql.includes("c.scope_project_id=$2")) return { rows: [{ definition: { selectors: [], tierMappings: [] }, import_id: "import-1", scope_project_id: 5 }] };
  if (configured && sql.includes("FROM sharepoint_project_mappings m")) return { rows: [{ state: "active", credential_state: "active", credential_id: "credential-1", site_id: "site-1", library_id: "drive-1" }] };
  return { rows: [] };
} };
let probes = 0;
const store = createFolderWizardPublishReadinessStore({ async connect() { return client; } }, { async verify(input) {
  probes++;
  assert.equal(input.companyId, 2);
  assert.equal(input.credentialId, "credential-1");
  return { siteUrl: "https://bimtech.sharepoint.com/sites/QA", libraryId: "drive-1" };
} });
assert.deepEqual(await store.read({ projectId: 5, actorUserId: 7 }), { ready: false, blockers: ["IMPORT_MISSING"], providerError: null });
assert.equal(probes, 0);
configured = true;
assert.deepEqual(await store.read({ projectId: 5, actorUserId: 7 }), { ready: true, blockers: [], providerError: null });
assert.equal(probes, 1);
assert.match(statements.join("\n"), /project_company_binding_versions/);
assert.match(statements.join("\n"), /pm\.status='active'/);
assert.match(statements.join("\n"), /m\.company_id=\$2/);
allowed = false;
await assert.rejects(() => store.read({ projectId: 5, actorUserId: 7 }), /FOLDER_WIZARD_FORBIDDEN/);
console.log("Folder Wizard publishing readiness tenant scope: PASS");
