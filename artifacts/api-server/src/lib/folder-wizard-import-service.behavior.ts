import assert from "node:assert/strict";
import { createFolderWizardImportService, FolderWizardImportError } from "./folder-wizard-import-service";

const fixture = (item: string) => JSON.stringify({ generated_by: "BT Folder Wizard", version: "3.1 (BIMLOG export)",
  destination: { sharepoint_url: "", base_path: "" }, blueprints: [{ name: "Test", include: true,
    tiers: [{ label: "ROOT", items: [item], mode: "none", start: 0, width: 2, sep: "_", case: "upper" }] }] });
const sqlSeen: string[] = [];
let companyId = 2;
let current: Record<string, unknown> | null = null;
let pending: Record<string, unknown> | null = null;
let releases = 0;
const database = { async connect() { return { release() { releases++; }, async query(sql: string, values: unknown[] = []) {
  sqlSeen.push(sql);
  if (sql.includes("FROM projects p JOIN users creator")) return { rows: companyId ? [{ company_id: companyId }] : [], rowCount: companyId ? 1 : 0 };
  if (sql.includes("FROM folder_wizard_current_imports c JOIN")) return { rows: current ? [current] : [], rowCount: current ? 1 : 0 };
  if (sql.includes("FROM folder_wizard_current_imports c\n")) return { rows: current ? [current] : [], rowCount: current ? 1 : 0 };
  if (sql.startsWith("INSERT INTO folder_wizard_imports")) pending = { id: values[0], version: values[3], source_sha256: values[4], source_text: values[5], imported_by_id: values[6], imported_at: new Date() };
  if (sql.startsWith("INSERT INTO folder_wizard_current_imports")) current = pending;
  return { rows: [], rowCount: 1 };
} }; } };
const service = createFolderWizardImportService(database);
const scope = { projectId: 5, actorUserId: 7 };
assert.equal(await service.current(scope), null);
assert.equal((await service.import(scope, fixture("A"), null)).version, 1);
assert.equal((await service.import(scope, fixture("A"), String(current!.source_sha256))).unchanged, true);
await assert.rejects(() => service.import(scope, fixture("B"), null), (error: unknown) => error instanceof FolderWizardImportError && error.status === 409);
assert.equal((await service.import(scope, fixture("B"), String(current!.source_sha256))).version, 2);
assert.equal((await service.current(scope))?.version, 2);
companyId = 0;
await assert.rejects(() => service.import(scope, fixture("C"), String(current!.source_sha256)), (error: unknown) => error instanceof FolderWizardImportError && error.status === 403);
assert.match(sqlSeen.join("\n"), /project_company_binding_versions/);
assert.match(sqlSeen.join("\n"), /pm\.status='active' AND pm\.role='project_admin'/);
assert.match(sqlSeen.join("\n"), /FOR UPDATE/);
assert.equal(releases, 7);
console.log("Folder Wizard project-scoped import: PASS");
