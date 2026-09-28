import assert from "node:assert/strict";
import { projectRoleReadiness } from "./project-role-readiness";

const reviewer = projectRoleReadiness({
  membershipStatus: "active",
  projectRole: "read_only",
  permissionCategory: "read",
  isCompanyPmo: false,
  workflowAssignments: ["review"],
});
assert.equal(reviewer.capabilities.reader, true);
assert.equal(reviewer.capabilities.reviewer, true);
assert.equal(reviewer.capabilities.executor, false);
assert.equal(reviewer.capabilities.lensEligible, true);

const executor = projectRoleReadiness({
  membershipStatus: "active",
  projectRole: "member",
  permissionCategory: "write",
  isCompanyPmo: false,
  workflowAssignments: ["execute"],
});
assert.equal(executor.capabilities.executor, true);
assert.equal(executor.capabilities.reviewer, false);
assert.ok(executor.missingSetup.includes("reviewer_assignment"));

const pmo = projectRoleReadiness({
  membershipStatus: "active",
  projectRole: "project_admin",
  permissionCategory: "admin",
  isCompanyPmo: true,
  workflowAssignments: [],
});
assert.equal(pmo.capabilities.pmo, true);
assert.equal(pmo.capabilities.lensEligible, true);

const superAdminIsNotAProjectGrant = projectRoleReadiness({
  membershipStatus: null,
  projectRole: null,
  isCompanyPmo: false,
  workflowAssignments: [],
});
assert.deepEqual(superAdminIsNotAProjectGrant.authorities, []);
assert.equal(superAdminIsNotAProjectGrant.capabilities.lensEligible, false);
console.log("C023 project role readiness: PASS");
