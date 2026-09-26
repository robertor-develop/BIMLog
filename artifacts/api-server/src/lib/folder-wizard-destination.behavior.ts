import assert from "node:assert/strict";
import { createFolderWizardDestinationStore } from "./folder-wizard-destination";

let admin = true;
let allowed = true;
let active = true;
let current: Record<string, unknown> | null = null;
let inserts = 0;
let audits = 0;
let verified = 0;
const pool = { async connect() { return {
  async query(sql: string, values?: unknown[]) {
    if (sql.includes("AS project_admin")) return { rows: allowed ? [{ company_id: 31, project_admin: admin }] : [] };
    if (sql.startsWith("SELECT id,credential_id")) return { rows: current ? [current] : [] };
    if (sql.startsWith("SELECT id,label")) return { rows: [{ id: "credential", label: "Company connection" }] };
    if (sql.startsWith("SELECT id FROM connector_credentials")) return { rows: active ? [{ id: "credential" }] : [] };
    if (sql.startsWith("INSERT INTO sharepoint_project_mappings")) {
      inserts++; current = { id: values![0], credentialId: values![3], siteId: values![4], libraryId: values![5], state: "active" };
    }
    if (sql.startsWith("INSERT INTO admin_actions_log")) audits++;
    return { rows: [] };
  }, release() {},
}; } };
const store = createFolderWizardDestinationStore(pool, { async verify(input) {
  verified++; assert.equal(input.companyId, 31);
  return { siteUrl: "https://synthetic.sharepoint.com/sites/QA", libraryId: input.libraryId };
} });
const scope = { projectId: 5, actorUserId: 7 };
const input = { credentialId: "credential", siteId: "site", libraryId: "library", confirmation: "configure_sharepoint_destination" };
assert.equal((await store.read(scope)).current, null);
admin = false;
assert.deepEqual((await store.read(scope)).credentials, []);
await assert.rejects(store.create(scope, input), /FORBIDDEN/);
assert.equal(verified, 0);
admin = true;
await assert.rejects(store.create(scope, { ...input, companyId: 999 }));
assert.equal((await store.create(scope, input)).result, "created");
assert.equal((await store.create(scope, input)).result, "idempotent");
assert.equal(inserts, 1); assert.equal(audits, 1);
await assert.rejects(store.create(scope, { ...input, libraryId: "other" }), /CONFLICT/);
assert.equal((await store.read(scope)).current?.libraryId, "library");
active = false;
await assert.rejects(store.create(scope, input), /UNVERIFIED/);
allowed = false;
await assert.rejects(store.read(scope), /FORBIDDEN/);
assert.equal(inserts, 1);
console.log("Folder Wizard destination permissions, projection, immutable save and retry: PASS (synthetic store)");
