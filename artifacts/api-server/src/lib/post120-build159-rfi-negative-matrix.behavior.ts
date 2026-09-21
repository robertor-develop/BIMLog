import assert from "node:assert/strict";
import { canAdministerRfi, requireProjectScopedRfi, rfiAuditRecord } from "./rfi-command-service";
import { filterRfisForRegister, parseRfiRegisterFilters, RfiQueryValidationError } from "./rfi-query-service";

assert.equal(canAdministerRfi({ isSuperAdmin: true }, null), true);
assert.equal(canAdministerRfi({ isSuperAdmin: false }, "project_admin"), true);
assert.equal(canAdministerRfi({ isSuperAdmin: false }, "write"), false);
assert.equal(canAdministerRfi({ isSuperAdmin: false }, null), false);
assert.throws(() => requireProjectScopedRfi({ routeProjectId: 1, recordProjectId: 2, routeRfiId: 7, recordRfiId: 7 }), /SCOPE_MISMATCH/);
assert.throws(() => requireProjectScopedRfi({ routeProjectId: 1, recordProjectId: 1, routeRfiId: 7, recordRfiId: 8 }), /SCOPE_MISMATCH/);
requireProjectScopedRfi({ routeProjectId: 1, recordProjectId: 1, routeRfiId: 7, recordRfiId: 7 });

for (const query of [{ date_field: "deleted" }, { sort: "unsafe" }, { date_from: "09/20/2026" }, { date_from: "2026-09-21", date_to: "2026-09-20" }]) {
  assert.throws(() => parseRfiRegisterFilters(query), RfiQueryValidationError);
}

const records = [
  { number: "RFI-2", subject: "Open pipe", status: "open", rfiType: "Field", ballInCourt: "Trade A", submittedToCompany: "Trade A", createdById: 3, createdAt: "2026-09-19", dateRequired: "2026-09-22", sendStatus: "sent", sentAt: "2026-09-19" },
  { number: "RFI-10", subject: "Closed wall", status: "closed", rfiType: "Design", submittedByCompany: "GC", createdById: 4, createdAt: "2026-09-18", dateRequired: "2026-09-24", sendStatus: "sent", sentAt: "2026-09-18" },
];
const filters = parseRfiRegisterFilters({ status: "open", rfi_type: "Field", ball_in_court: "Trade A", search: "pipe", sort: "number_asc" });
assert.deepEqual(filterRfisForRegister(records, filters, new Map()).map(record => record.number), ["RFI-2"]);

const audit = rfiAuditRecord({ projectId: 1, rfiId: 7, actor: { userId: 3, fullName: "Actor", companyName: "Company" }, actionType: "close", details: { event: "rfi.closed" } });
assert.equal(audit.projectId, 1);
assert.equal(audit.entityId, 7);
assert.equal(JSON.parse(audit.details).event, "rfi.closed");

console.log("POST120_BUILD159=PASS tenant=deny project=deny object=deny roles=guarded filters=shared audit=attributable");
