import assert from "node:assert/strict";
import fs from "node:fs";
import { decideEdtRecordAuthorization, permissionsForDefaultRole } from "./edt-engine-authorization";

const base = {
  permission: "QC_APPROVE" as const,
  grants: permissionsForDefaultRole("PROJECT_MANAGER"),
  actorUserId: 50,
  actorCompanyId: 5,
  actorProjectIds: [10],
  recordCompanyId: 5,
  recordProjectId: 10,
  recordCreatorUserId: 40,
  recordRequesterUserId: 41,
  eligibleUserIds: [50],
  conflictUserIds: [] as number[],
};

const matrix = [
  [base, true, "AUTHORIZED"],
  [{ ...base, grants: [] }, false, "PERMISSION_REQUIRED"],
  [{ ...base, actorCompanyId: 6 }, false, "COMPANY_SCOPE_REQUIRED"],
  [{ ...base, actorProjectIds: [] }, false, "PROJECT_SCOPE_REQUIRED"],
  [{ ...base, eligibleUserIds: [51] }, false, "RECORD_ELIGIBILITY_REQUIRED"],
  [{ ...base, recordRequesterUserId: 50 }, false, "SELF_APPROVAL_PROHIBITED"],
  [{ ...base, conflictUserIds: [50] }, false, "CONFLICT_OF_INTEREST"],
] as const;

for (const [input, allow, code] of matrix) {
  const decision = decideEdtRecordAuthorization(input);
  assert.equal(decision.allow, allow);
  assert.equal(decision.code, code);
}

const route = fs.readFileSync(new URL("../routes/company-master-catalogs.ts", import.meta.url), "utf8");
const ui = fs.readFileSync(new URL("../../../../artifacts/bimlog/src/components/admin/CompanyMasterCatalogsTab.tsx", import.meta.url), "utf8");
assert.match(route, /authMiddleware/);
assert.match(route, /entry\.company_id=\$2/);
assert.match(route, /ji\.company_id=\$2/);
assert.match(route, /expectedVersion/);
assert.doesNotMatch(route, /DELETE FROM company_master_catalog_entries/i);
assert.match(ui, /aria-pressed/);
assert.match(ui, /aria-labelledby/);
assert.match(ui, /role="status"/);
assert.match(ui, /role="alert"/);
assert.match(ui, /kinds\.filter\(kind => kind === selectedKind\)/);

console.log("EDT_ENGINE_BUILD285_RESULT=PASS");
