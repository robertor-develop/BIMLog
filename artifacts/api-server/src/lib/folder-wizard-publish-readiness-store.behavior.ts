import assert from "node:assert/strict";
import { createFolderWizardPublishReadinessStore } from "./folder-wizard-publish-readiness-store";

let allowed = true;
const statements: string[] = [];
const client = { release() {}, async query(sql: string) {
  statements.push(sql);
  if (sql.includes("FROM projects p JOIN users creator")) return { rows: allowed ? [{ company_id: 2 }] : [] };
  return { rows: [] };
} };
const store = createFolderWizardPublishReadinessStore({ async connect() { return client; } });
assert.deepEqual(await store.read({ projectId: 5, actorUserId: 7 }), { ready: false, blockers: ["IMPORT_MISSING"] });
assert.match(statements.join("\n"), /project_company_binding_versions/);
assert.match(statements.join("\n"), /pm\.status='active'/);
assert.match(statements.join("\n"), /m\.company_id=\$2/);
allowed = false;
await assert.rejects(() => store.read({ projectId: 5, actorUserId: 7 }), /FOLDER_WIZARD_FORBIDDEN/);
console.log("Folder Wizard publishing readiness tenant scope: PASS");
