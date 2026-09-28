import assert from "node:assert/strict";
import { reportViewAccess, selectVersionedDefault, updateOwnedReportView, type OwnedReportView } from "./report-view-ownership";

const shared: OwnedReportView = { id: "company-view", owner: { scope: "company", companyId: 31 }, version: 4, defaultVersion: 4, readOnly: false };
const reader = { userId: 8, companyId: 31, canManageCompanyViews: false };
assert.deepEqual(reportViewAccess(shared, reader), { canRead: true, canEdit: false, canSetDefault: false });
assert.throws(() => updateOwnedReportView({ view: shared, actor: reader, expectedVersion: 4 }), /WRITE_DENIED/);
assert.throws(() => updateOwnedReportView({ view: shared, actor: { ...reader, canManageCompanyViews: true }, expectedVersion: 3 }), /VERSION_CONFLICT/);
const updated = updateOwnedReportView({ view: shared, actor: { ...reader, canManageCompanyViews: true }, expectedVersion: 4, setDefault: true });
assert.equal(updated.version, 5); assert.equal(updated.defaultVersion, 5);
assert.equal(selectVersionedDefault([shared, { ...updated, defaultVersion: 4 }])?.id, "company-view");
console.log("C037 report-view ownership and versioned defaults: PASS");
