import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relative: string) => fs.readFileSync(path.resolve(here, relative), "utf8");
const content = read("../../../../artifacts/bimlog/src/lib/help-content.ts");
const page = read("../../../../artifacts/bimlog/src/pages/HelpCenter.tsx");
const guide = read("../../../../artifacts/bimlog/src/components/layout/SmartGuide.tsx");
const sidebar = read("../../../../artifacts/bimlog/src/components/layout/SidebarUtilities.tsx");
const projectSidebar = read("../../../../artifacts/bimlog/src/components/layout/ProjectSidebar.tsx");
const navbar = read("../../../../artifacts/bimlog/src/components/layout/Navbar.tsx");
const styles = read("../../../../artifacts/bimlog/src/index.css");
const app = read("../../../../artifacts/bimlog/src/App.tsx");
const legacy = read("../../../../artifacts/bimlog/src/pages/SetupGuide.tsx");

for (const id of ["getting-started", "command-center", "coordination-files", "job-intake", "job-operations", "rfis", "submittals-transmittals", "changes-meetings", "planning", "commercial-overview", "budget-contracts", "cost-value-planner", "team-performance", "insights-reports", "directory-administration", "integrations"]) {
  assert.match(content, new RegExp(`id: "${id}"`), `${id} must be covered by the canonical manual`);
}
for (const phrase of ["Help Center", "Centro de ayuda", "User Manual", "Manual del usuario", "Quick Guides", "Guías rápidas", "Troubleshooting", "Solución de problemas", "What's New", "Novedades"]) {
  assert.ok(page.includes(phrase), `${phrase} must be visible in the bilingual Help Center`);
}
assert.match(page, /normalize\("NFD"\)/, "search must remain accent-insensitive");
assert.match(page, /HELP_CATEGORIES/);
assert.match(page, /HELP_TROUBLESHOOTING/);
assert.match(page, /HELP_RELEASES/);
assert.match(page, /@media\(max-width:850px\)/, "Help Center must be responsive");
for (const field of ["purpose", "keyConcepts", "permissions", "fields", "calculations", "savedRecords", "outputs", "example"]) assert.match(content, new RegExp(field), `full manual must define ${field}`);
for (const heading of ["Purpose and when to use it", "Access and permissions", "Fields and what they mean", "Calculations and formulas", "What BIMLog saves", "Outputs and exports", "Worked example"]) assert.match(page, new RegExp(heading));
assert.match(page, /Print this manual section/);
assert.match(page, /@media print/);
assert.match(guide, /helpTopicForContext/, "quick guide must use the canonical documentation catalog");
assert.match(guide, /Open complete instructions/);
assert.match(guide, /Abrir instrucciones completas/);
assert.match(sidebar, /\/help\?topic=getting-started&view=manual/);
const infoLinks = sidebar.match(/const INFO_LINKS = \[([\s\S]*?)\];/)?.[1] ?? "";
assert.doesNotMatch(infoLinks, /User Manual|Manual del usuario/, "Info must not duplicate the manual housed in Help Center");
assert.match(projectSidebar, /collapsed-sidebar-expand/);
assert.match(projectSidebar, /Expand navigation/);
assert.match(projectSidebar, /Expandir navegación/);
assert.match(navbar, /bimlog-theme/);
assert.match(navbar, /Use dark mode/);
assert.match(navbar, /Usar modo oscuro/);
assert.match(styles, /\.dark \{/);
assert.match(styles, /\.collapsed-sidebar-expand/);
assert.match(app, /path="\/help"/);
assert.match(app, /ProtectedRoute component=\{HelpCenter\}/);
assert.match(legacy, /HelpCenter as SetupGuide/, "legacy setup-guide source must not retain a second documentation catalog");

console.log(JSON.stringify({ status: "PASS", tests: ["canonical-source", "released-feature-coverage", "bilingual-manual", "quick-guides", "troubleshooting", "release-information", "contextual-guide", "manual-not-duplicated-in-info", "collapsed-navigation-recovery", "persistent-day-night-mode", "accent-insensitive-search", "responsive-layout", "protected-route", "legacy-convergence"] }));
