import assert from "node:assert/strict";
import fs from "node:fs";
import { capabilityDirectory, capabilityGroups, resolveCapabilityDirectoryViews } from "./capability-directory";
import { dashboardCardInventory } from "./dashboard-card-inventory";
import { pendingItemLifecycle } from "./pending-item-lifecycle";
import type { AccessProfile, AccessSurface } from "./access-profile";

const surfaces: AccessSurface[] = ["dashboard", "project_workspace", "project_administration", "total_control", "living_brief", "company_catalogs", "company_pricing", "company_workflows", "feedback_administration"];
const profile = (allowed: AccessSurface[], projects = [17]): AccessProfile => ({ facts: { authenticated: true, isSuperAdmin: false, canAccessLivingBrief: false, isCompanyPmo: false, isFinancialAdministrator: false, activeProjectRoles: projects.length ? ["member"] : [], activeProjects: projects.map(id => ({ id, role: "member" })) }, decisions: Object.fromEntries(surfaces.map(surface => [surface, { allow: allowed.includes(surface), code: allowed.includes(surface) ? "ALLOW" : "DENY" }])) as AccessProfile["decisions"] });

const memberViews = resolveCapabilityDirectoryViews(profile(["dashboard", "project_workspace"]));
const adminViews = resolveCapabilityDirectoryViews(profile(["dashboard", "project_workspace", "project_administration", "company_catalogs", "company_pricing", "company_workflows"]));
assert.equal(memberViews.length, capabilityDirectory.length, "novices must see every capability and its truthful permission state");
assert.ok(["intake", "operations", "files", "reports"].every(id => memberViews.find(entry => entry.id === id)?.href), "principal novice journey must be executable");
assert.ok(adminViews.every(entry => entry.availability !== "administrator-only" || entry.audience === "total_control" || entry.audience === "feedback_administration" || entry.audience === "living_brief"), "authorized administration routes must be directly reachable");
assert.ok(adminViews.filter(entry => entry.href).every(entry => entry.guidance?.prerequisite.en && entry.guidance.actor.en && entry.guidance.nextStep.en), "expert routes retain comprehension context");
assert.deepEqual(capabilityGroups.slice(0, 6).map(group => group.id), ["Home", "Intake", "Operations", "Documents", "Coordination", "Reports"]);
assert.ok(!capabilityGroups.some(group => /more|advanced/i.test(group.id)));
assert.ok(dashboardCardInventory.every(card => card.destination !== "/projects"));
for (const type of ["rfis", "submittals", "files"] as const) assert.ok(Object.values(pendingItemLifecycle(type, { status: "pending", title: "Record" }, "en")).every(Boolean));

const page = fs.readFileSync(new URL("../pages/AllTools.tsx", import.meta.url), "utf8");
assert.match(page, /Recommended project journey/);
assert.match(page, /Direct expert access/);
assert.match(page, /Before you start:/);
assert.match(page, /Who acts:/);
assert.match(page, /Next:/);
assert.match(page, /aria-disabled=\{!entry\.href\}/);
console.log(`CAPABILITY_COMPREHENSION_P020=PASS noviceSteps=4 expertEntries=${adminViews.filter(entry => entry.href).length} capabilities=${capabilityDirectory.length}`);
