import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const projectDetail = readFileSync(new URL("./pages/ProjectDetail.tsx", import.meta.url), "utf8");
const projectTabs = [...projectDetail.matchAll(/namedProjectTab\(\(\) => import\("\.\/project\/([^\"]+)"\)/g)]
  .map((match) => match[1]);

const expectedTabs = [
  "FilesTab",
  "RfisTab",
  "SubmittalsTab",
  "ActivityTab",
  "TeamTab",
  "ConventionBuilder",
  "NameGenerator",
  "AnalyticsTab",
  "IntegrationsTab",
  "ReportsTab",
  "DirectoryTab",
  "TransmittalsTab",
  "ChangeOrdersTab",
  "MeetingsTab",
  "ScheduleTab",
  "ClashReportsTab",
  "CoordinationHub",
  "CoordinatorCommandCenter",
];

assert.deepEqual(projectTabs.sort(), expectedTabs.sort(), "every ProjectDetail workspace has one lazy boundary");
assert.doesNotMatch(projectDetail, /^import \{ .*Tab.* \} from "\.\/project\//m, "project workspaces are not eagerly imported");
assert.match(projectDetail, /<React\.Suspense[\s\S]*role="status" aria-live="polite"/, "workspace loading is announced accessibly");
assert.match(projectDetail, /<ProjectSidebar[\s\S]*<React\.Suspense/, "the project shell stays outside the workspace loading boundary");

console.log(`PASS ${projectTabs.length} project workspaces use independent lazy imports`);
console.log("PASS the project shell remains visible while a workspace loads");
console.log("PASS the workspace loading state is announced accessibly");
console.log("SUMMARY 3/3 PASS");
