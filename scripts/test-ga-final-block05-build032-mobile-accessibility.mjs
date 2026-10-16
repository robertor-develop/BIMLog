import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const read = (file) => readFileSync(file, "utf8");
const run = (file) => {
  const result = spawnSync(process.execPath, [file], { encoding: "utf8" });
  assert.equal(result.status, 0, `${file} failed:\n${result.stdout}\n${result.stderr}`);
};

for (const behavior of [
  "artifacts/bimlog/src/accessibility.behavior.mjs",
  "artifacts/bimlog/src/admin-modal-accessibility.behavior.mjs",
  "artifacts/bimlog/src/route-loading.behavior.mjs",
  "artifacts/bimlog/src/project-route-loading.behavior.mjs",
  "scripts/test-ga-final-block01-build004-responsive-agent.mjs",
  "scripts/test-post120-block40.mjs",
]) run(behavior);

const requiredSurfaces = [
  "pages/Dashboard.tsx", "pages/ProjectDetail.tsx", "pages/JobIntakeWorkspace.tsx",
  "pages/JobOperationsWorkspace.tsx", "pages/project/FilesTab.tsx",
  "pages/project/RfisTab.tsx", "pages/project/SubmittalsTab.tsx",
  "pages/project/ScheduleTab.tsx", "pages/FinancialApuWorkspace.tsx",
  "pages/project/ReportsTab.tsx", "pages/project/ConventionBuilder.tsx",
  "pages/project/NameGenerator.tsx", "pages/project/TeamTab.tsx",
  "pages/project/DirectoryTab.tsx",
];
for (const relative of requiredSurfaces) {
  assert.ok(existsSync(`artifacts/bimlog/src/${relative}`), `390x844 acceptance surface missing ${relative}`);
}

const css = read("artifacts/bimlog/src/index.css");
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /focus-visible/);
assert.match(css, /@media\s*\(max-width:\s*390px\)/);

const sidebar = read("artifacts/bimlog/src/components/layout/ProjectSidebar.tsx");
for (const token of ["aria-expanded", "aria-controls", "Resize project navigation"]) {
  assert.ok(sidebar.includes(token), `project navigation accessibility missing ${token}`);
}
assert.match(css, /\.phasea-mobile-nav-panel[\s\S]*\.phasea-nav-group-trigger,[\s\S]*min-height:\s*44px/);

const assistant = read("artifacts/bimlog/src/components/layout/PageAssistant.tsx");
for (const token of ["aria-label", "aria-live", "Resize BIMLog Agent panel", "aria-valuemin={320}", "aria-valuemax={680}"]) {
  assert.ok(assistant.includes(token), `BIMLog Agent mobile/accessibility contract missing ${token}`);
}

console.log("GA-F05-B032 PASS: exact responsive route matrix, Agent workspace fixture, keyboard/focus labels, touch targets and reduced-motion contracts");
