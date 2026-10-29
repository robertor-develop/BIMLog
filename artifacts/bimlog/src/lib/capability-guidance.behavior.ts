import assert from "node:assert/strict";
import fs from "node:fs";
import { capabilityDirectory, capabilityGuidance, resolveCapabilityDirectoryViews } from "./capability-directory";
import type { AccessProfile, AccessSurface } from "./access-profile";

assert.deepEqual(Object.keys(capabilityGuidance).sort(), capabilityDirectory.map(entry => entry.id).sort());
assert.ok(Object.values(capabilityGuidance).every(value => value.prerequisite.en && value.prerequisite.es && value.actor.en && value.actor.es && value.nextStep.en && value.nextStep.es));
const surfaces: AccessSurface[] = ["dashboard", "project_workspace", "project_administration", "total_control", "living_brief", "company_catalogs", "company_pricing", "company_workflows", "feedback_administration"];
const profile: AccessProfile = { facts: { authenticated: true, isSuperAdmin: false, canAccessLivingBrief: false, isCompanyPmo: false, isFinancialAdministrator: false, activeProjectRoles: ["member"], activeProjects: [{ id: 17, role: "member" }] }, decisions: Object.fromEntries(surfaces.map(surface => [surface, { allow: true, code: "ALLOW" }])) as AccessProfile["decisions"] };
assert.ok(resolveCapabilityDirectoryViews(profile).every(entry => entry.guidance));
const source = fs.readFileSync(new URL("../pages/AllTools.tsx", import.meta.url), "utf8");
assert.match(source, /Before you start:.*Antes de empezar:/s);
assert.match(source, /Who acts:.*Quién actúa:/s);
assert.match(source, /Next:.*Siguiente:/s);
console.log(`CAPABILITY_GUIDANCE_P013=PASS capabilities=${capabilityDirectory.length}`);
