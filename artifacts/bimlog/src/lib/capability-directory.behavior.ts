import assert from "node:assert/strict";
import { capabilityDirectory, resolveCapabilityDirectory } from "./capability-directory";
import type { AccessProfile, AccessSurface } from "./access-profile";

const surfaces: AccessSurface[] = ["dashboard", "project_workspace", "project_administration", "total_control", "living_brief", "company_catalogs", "company_pricing", "company_workflows", "feedback_administration"];
const profile = (allowed: AccessSurface[], projects = [17]): AccessProfile => ({
  facts: { authenticated: true, isSuperAdmin: false, canAccessLivingBrief: false, isCompanyPmo: false, isFinancialAdministrator: false, activeProjectRoles: projects.length ? ["member"] : [], activeProjects: projects.map(id => ({ id, role: "member" })) },
  decisions: Object.fromEntries(surfaces.map(surface => [surface, { allow: allowed.includes(surface), code: allowed.includes(surface) ? "ALLOW" : "DENY" }])) as AccessProfile["decisions"]
});
assert.equal(new Set(capabilityDirectory.map(({ id }) => id)).size, capabilityDirectory.length);
assert.ok(capabilityDirectory.every(entry => entry.name.en && entry.name.es && entry.purpose.en && entry.purpose.es && entry.tasks.length));
const member = resolveCapabilityDirectory(profile(["dashboard", "project_workspace"]));
assert.ok(member.some(({ id, href }) => id === "rfis" && href === "/projects/17/rfis"));
assert.ok(!member.some(({ id }) => id === "project-admin"));
const admin = resolveCapabilityDirectory(profile(["dashboard", "project_workspace", "project_administration", "company_catalogs", "company_workflows", "company_pricing"]));
assert.ok(["project-admin", "catalogs", "workflows", "governance", "pricing-templates"].every(id => admin.some(entry => entry.id === id)));
const zeroProject = resolveCapabilityDirectory(profile(["dashboard"], []));
assert.ok(!zeroProject.some(({ projectRequired }) => projectRequired));
console.log(`CAPABILITY_DIRECTORY_P006=PASS entries=${capabilityDirectory.length} member=${member.length} admin=${admin.length}`);
