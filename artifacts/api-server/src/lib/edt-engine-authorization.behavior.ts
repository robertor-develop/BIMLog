import assert from "node:assert/strict";
import {
  EDT_DEFAULT_ROLE_PROFILES,
  decideEdtRecordAuthorization,
  permissionsForDefaultRole,
} from "./edt-engine-authorization";

assert.deepEqual(Object.keys(EDT_DEFAULT_ROLE_PROFILES), [
  "CEO",
  "OPERATIONS_DIRECTOR",
  "PMO",
  "PROJECT_LEADER",
  "BIM_COORDINATOR",
  "PROJECT_MANAGER",
  "DRAFTER",
  "QC_MANAGER",
]);
assert.equal(permissionsForDefaultRole("PROJECT_MANAGER").includes("QC_APPROVE"), true);
assert.equal(permissionsForDefaultRole("QC_MANAGER").includes("QC_INDEPENDENT_APPROVE"), true);
assert.equal(permissionsForDefaultRole("DRAFTER").includes("QC_APPROVE"), false);

const eligibleApproval = {
  permission: "QC_APPROVE" as const,
  grants: permissionsForDefaultRole("PROJECT_MANAGER"),
  actorUserId: 22,
  actorCompanyId: 7,
  actorProjectIds: [44],
  recordCompanyId: 7,
  recordProjectId: 44,
  recordCreatorUserId: 11,
  recordRequesterUserId: 12,
  eligibleUserIds: [22, 23],
  conflictUserIds: [99],
};

assert.deepEqual(decideEdtRecordAuthorization(eligibleApproval), {
  allow: true,
  code: "AUTHORIZED",
});
assert.equal(
  decideEdtRecordAuthorization({ ...eligibleApproval, actorCompanyId: 8 }).code,
  "COMPANY_SCOPE_REQUIRED",
);
assert.equal(
  decideEdtRecordAuthorization({ ...eligibleApproval, actorProjectIds: [45] }).code,
  "PROJECT_SCOPE_REQUIRED",
);
assert.equal(
  decideEdtRecordAuthorization({ ...eligibleApproval, eligibleUserIds: [23] }).code,
  "RECORD_ELIGIBILITY_REQUIRED",
);
assert.equal(
  decideEdtRecordAuthorization({ ...eligibleApproval, recordCreatorUserId: 22 }).code,
  "SELF_APPROVAL_PROHIBITED",
);
assert.equal(
  decideEdtRecordAuthorization({ ...eligibleApproval, conflictUserIds: [22] }).code,
  "CONFLICT_OF_INTEREST",
);
assert.equal(
  decideEdtRecordAuthorization({ ...eligibleApproval, requireIndependentApprover: true }).code,
  "INDEPENDENT_APPROVER_REQUIRED",
);
assert.equal(
  decideEdtRecordAuthorization({
    ...eligibleApproval,
    grants: permissionsForDefaultRole("QC_MANAGER"),
    requireIndependentApprover: true,
  }).code,
  "AUTHORIZED",
);
assert.equal(
  decideEdtRecordAuthorization({ ...eligibleApproval, grants: ["SUPER_ADMIN"] }).code,
  "INVALID_PERMISSION_GRANT",
  "administrative titles cannot bypass the engine",
);

console.log("EDT_ENGINE_BUILD282_RESULT=PASS");
