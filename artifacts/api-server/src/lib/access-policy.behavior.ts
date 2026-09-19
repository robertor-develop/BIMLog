import assert from "node:assert/strict";
import { ACCESS_SURFACES, accessMatrix, decideAccess, type AccessFacts } from "./access-policy";

const facts = (overrides: Partial<AccessFacts> = {}): AccessFacts => ({
  authenticated: true,
  isSuperAdmin: false,
  canAccessLivingBrief: false,
  isCompanyPmo: false,
  isFinancialAdministrator: false,
  activeProjectRoles: [],
  ...overrides,
});

const superAdmin = accessMatrix(facts({ isSuperAdmin: true }));
assert.deepEqual(Object.keys(superAdmin), [...ACCESS_SURFACES]);
for (const decision of Object.values(superAdmin)) assert.equal(decision.allow, true);

const pmo = accessMatrix(facts({ isCompanyPmo: true }));
for (const surface of ["company_catalogs", "company_pricing", "company_workflows"] as const)
  assert.deepEqual(pmo[surface], { allow: true, code: "COMPANY_PMO" });
assert.equal(pmo.total_control.allow, false);

const projectAdmin = accessMatrix(facts({ activeProjectRoles: ["project_admin"] }));
assert.equal(projectAdmin.project_workspace.allow, true);
assert.equal(projectAdmin.project_administration.allow, true);
assert.equal(projectAdmin.feedback_administration.allow, true);
assert.equal(projectAdmin.company_catalogs.allow, false);

const member = accessMatrix(facts({ activeProjectRoles: ["member"] }));
assert.equal(member.project_workspace.allow, true);
assert.equal(member.project_administration.allow, false);
assert.equal(member.feedback_administration.allow, false);

const zeroProject = accessMatrix(facts());
assert.equal(zeroProject.dashboard.allow, true);
assert.deepEqual(zeroProject.project_workspace, { allow: false, code: "ACTIVE_PROJECT_MEMBERSHIP_REQUIRED" });

const explicitBrief = decideAccess("living_brief", facts({ canAccessLivingBrief: true }));
assert.deepEqual(explicitBrief, { allow: true, code: "EXPLICIT_LIVING_BRIEF_GRANT" });

const denied = accessMatrix(facts({ authenticated: false, isSuperAdmin: true, activeProjectRoles: ["project_admin"] }));
for (const decision of Object.values(denied)) assert.deepEqual(decision, { allow: false, code: "AUTHENTICATION_REQUIRED" });

console.log("access policy matrix: 45/45 passed");
