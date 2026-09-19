import assert from "node:assert/strict";
import { resolveProjectContext, type AccessProfile } from "./access-profile";

const profile = (overrides: Partial<AccessProfile["facts"]> = {}): AccessProfile => ({
  facts: {
    authenticated: true,
    isSuperAdmin: false,
    canAccessLivingBrief: false,
    isCompanyPmo: false,
    isFinancialAdministrator: false,
    activeProjectRoles: [],
    activeProjects: [],
    ...overrides,
  },
  decisions: {} as AccessProfile["decisions"],
});

assert.deepEqual(resolveProjectContext(profile({ isSuperAdmin: true }), 91), { allow: true, kind: "global_super_admin", projectId: 91, role: "super_admin" });
assert.deepEqual(resolveProjectContext(profile({ activeProjectRoles: ["member"], activeProjects: [{ id: 7, role: "member" }] }), 7), { allow: true, kind: "project_membership", projectId: 7, role: "member" });
assert.deepEqual(resolveProjectContext(profile({ activeProjectRoles: ["member"], activeProjects: [{ id: 7, role: "member" }] }), 8), { allow: false, kind: "project_denied", projectId: 8, role: null });
assert.deepEqual(resolveProjectContext(profile(), 8), { allow: false, kind: "zero_project", projectId: 8, role: null });
assert.deepEqual(resolveProjectContext(profile(), null), { allow: false, kind: "zero_project", projectId: null, role: null });

console.log("project context: 5/5 passed");
