import assert from "node:assert/strict";
import { createFolderWizardRoutingService } from "./folder-wizard-routing-service";
import { FolderWizardImportError } from "./folder-wizard-import-service";

const source = JSON.stringify({ generated_by: "BT Folder Wizard", version: "3.1 (BIMLOG export)",
  destination: { sharepoint_url: "", base_path: "" }, blueprints: [{ name: "Trade", include: true,
    tiers: [{ label: "LEVEL", items: ["L1", "L2"], mode: "none", start: 0, width: 0, sep: "_", case: "upper" }] }] });
const definition = { selectors: [], tierMappings: [{ blueprintName: "Trade", tierLabel: "LEVEL", tagKey: "level",
  values: [{ tagValue: "01", item: "L1" }] }] };
let pmo = true;
let projectAdmin = true;
let sourceId = "import-1";
const profiles = new Map<string, Record<string, unknown>>();
let pending: Record<string, unknown> | null = null;
const statements: string[] = [];
const database = { async connect() { return { release() {}, async query(sql: string, args: unknown[] = []) {
  statements.push(sql);
  if (sql.includes("FROM projects p JOIN users creator")) return { rows: [{ company_id: 2, is_pmo: pmo, is_project_admin: projectAdmin }], rowCount: 1 };
  if (sql.includes("FROM folder_wizard_current_imports c")) return { rows: [{ id: sourceId, source_text: source, source_sha256: "a".repeat(64) }], rowCount: 1 };
  if (sql.includes("FROM folder_wizard_current_routing_profiles c")) {
    const row = profiles.get(args[1] === null ? "company" : "project");
    return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
  }
  if (sql.startsWith("INSERT INTO folder_wizard_routing_profiles")) pending = { id: args[0], scope_project_id: args[2], import_id: args[3], version: args[4], definition: JSON.parse(String(args[5])), fingerprint: args[6] };
  if (sql.startsWith("INSERT INTO folder_wizard_current_routing_profiles")) profiles.set(args[2] === null ? "company" : "project", pending!);
  return { rows: [], rowCount: 1 };
} }; } };
const service = createFolderWizardRoutingService(database);
const scope = { projectId: 10, actorUserId: 4 };
assert.equal((await service.current(scope)).profile, null);
const first = await service.save(scope, { scopeType: "company", definition, expectedFingerprint: null });
assert.equal(first.version, 1);
assert.equal((await service.current(scope)).scopeType, "company");
assert.equal((await service.save(scope, { scopeType: "project", definition, expectedFingerprint: null })).version, 1);
assert.equal((await service.current(scope)).scopeType, "project");
assert.equal((await service.current(scope)).profile?.valid, true);
sourceId = "import-2";
assert.equal((await service.current(scope)).profile?.stale, true);
await assert.rejects(() => service.save(scope, { scopeType: "project", definition, expectedFingerprint: null }),
  (error: unknown) => error instanceof FolderWizardImportError && error.status === 409);
pmo = false;
await assert.rejects(() => service.save(scope, { scopeType: "company", definition, expectedFingerprint: first.fingerprint }),
  (error: unknown) => error instanceof FolderWizardImportError && error.status === 403);
projectAdmin = false;
await assert.rejects(() => service.save(scope, { scopeType: "project", definition, expectedFingerprint: first.fingerprint }),
  (error: unknown) => error instanceof FolderWizardImportError && error.status === 403);
assert.match(statements.join("\n"), /project_company_binding_versions/);
assert.match(statements.join("\n"), /company_master_catalog_administrators/);
assert.match(statements.join("\n"), /FOR UPDATE/);
console.log("Folder Wizard routing profile authority and versions: PASS");
