import assert from "node:assert/strict";
import fs from "node:fs";
import { capabilityDirectory, capabilityGroups, resolveCapabilityDirectoryViews } from "./capability-directory";
import type { AccessProfile, AccessSurface } from "./access-profile";

const surfaces: AccessSurface[] = ["dashboard", "project_workspace", "project_administration", "total_control", "living_brief", "company_catalogs", "company_pricing", "company_workflows", "feedback_administration"];
const profile = (allowed: AccessSurface[], projects: number[] = [17], superAdmin = false): AccessProfile => ({
  facts: { authenticated: true, isSuperAdmin: superAdmin, canAccessLivingBrief: false, isCompanyPmo: false, isFinancialAdministrator: false, activeProjectRoles: projects.map(() => "member"), activeProjects: projects.map(id => ({ id, role: "member" })) },
  decisions: Object.fromEntries(surfaces.map(surface => [surface, { allow: allowed.includes(surface), code: allowed.includes(surface) ? "ALLOW" : "DENY" }])) as AccessProfile["decisions"],
});

const member = resolveCapabilityDirectoryViews(profile(["dashboard", "project_workspace"]));
assert.equal(member.find(entry => entry.id === "rfis")?.href, "/projects/17/rfis", "project routes must remain membership scoped");
assert.equal(member.find(entry => entry.id === "governance")?.href, undefined, "company administration must not leak to members");
assert.equal(member.find(entry => entry.id === "governance")?.availability, "administrator-only");
const noProject = resolveCapabilityDirectoryViews(profile(["dashboard"], []));
assert.equal(noProject.find(entry => entry.id === "operations")?.availability, "requires-project");
assert.equal(noProject.find(entry => entry.id === "operations")?.href, undefined);
const companyAdmin = resolveCapabilityDirectoryViews(profile(["dashboard", "company_catalogs", "company_pricing", "company_workflows"], []));
assert.equal(companyAdmin.find(entry => entry.id === "governance")?.href, "/company-workflow-governance");
assert.equal(companyAdmin.find(entry => entry.id === "operations")?.href, undefined);
assert.ok(capabilityGroups.every(group => group.label.en && group.label.es && group.description.en && group.description.es), "every group must be localized");
assert.ok(capabilityDirectory.every(entry => entry.name.en && entry.name.es && entry.purpose.en && entry.purpose.es), "every capability must be localized");

const page = fs.readFileSync(new URL("../pages/AllTools.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../pages/AllTools.css", import.meta.url), "utf8");
const sidebar = fs.readFileSync(new URL("../components/layout/MasterSidebar.tsx", import.meta.url), "utf8");
assert.match(page, /role="search"/);
assert.match(page, /label htmlFor="all-tools-search" className="sr-only"/);
assert.match(page, /aria-disabled=\{!entry\.href\}/);
assert.match(page, /aria-describedby=\{`tool-purpose-\$\{entry\.id\}`\}/);
assert.match(css, /:focus-visible/);
assert.match(css, /@media \(max-width: 720px\)[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
assert.match(css, /prefers-reduced-motion/);
assert.match(sidebar, /Daily work.*Full capability directory/s);
assert.match(sidebar, /isMobile.*mobileOpen.*role=\{isMobile \? "dialog"/s);
console.log(`NAVIGATION_PARITY_REGRESSION_P015=PASS roles=3 capabilities=${capabilityDirectory.length} groups=${capabilityGroups.length}`);
