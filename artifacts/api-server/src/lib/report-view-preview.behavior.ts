import assert from "node:assert/strict";
import { duplicateReportViewAsPersonal, openReportView, saveReportView } from "./report-view-preview";

const actor = { userId: 9, companyId: 31, canManageCompanyViews: false };
const shared = { id: "shared-1", name: "Company overdue", configuration: { overdue: true }, owner: { scope: "company" as const, companyId: 31 }, version: 7, defaultVersion: 7, readOnly: false };
const preview = openReportView(shared, actor, "preview");
assert.equal(preview.writable, false); assert.equal(preview.autosave, false);
assert.throws(() => saveReportView(preview), /EXPLICIT_EDIT_REQUIRED/);
assert.throws(() => openReportView(shared, actor, "edit"), /WRITE_DENIED/);
const copy = duplicateReportViewAsPersonal({ source: shared, actor, newId: "personal-1", newName: "My overdue" });
assert.deepEqual(copy.owner, { scope: "personal", userId: 9 }); assert.equal(copy.version, 1); assert.deepEqual(copy.configuration, shared.configuration);
console.log("C039 safe report-view preview and duplicate: PASS");
