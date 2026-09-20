import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const workspaceRoot = path.resolve(import.meta.dirname, "../../../..");
const read = (relative: string) => fs.readFileSync(path.join(workspaceRoot, relative), "utf8");
const dashboardRoute = read("artifacts/api-server/src/routes/dashboard_briefing.ts");
const dashboardUi = read("artifacts/bimlog/src/pages/Dashboard.tsx");
const rfiUi = read("artifacts/bimlog/src/pages/project/RfisTab.tsx");
const catalog = read("artifacts/api-server/src/lib/initial-feature-catalog.ts");
const controlPlane = read("artifacts/api-server/src/lib/ai-control-plane.ts");

assert.doesNotMatch(dashboardRoute, /getAnthropicClientForUser|messages\.create/);
assert.match(dashboardRoute, /deterministicBriefing/);
assert.match(dashboardUi, /Project briefing/);
assert.match(dashboardUi, /No external AI request/);
assert.doesNotMatch(dashboardUi, /Get AI Morning Briefing|Generating AI briefing/);
assert.match(rfiUi, /AI draft ready — review before saving/);
assert.match(catalog, /key: "concierge\.click_driven"[\s\S]*?status: "coming_later"/);
assert.match(catalog, /key: "concierge\.intelligence"[\s\S]*?status: "coming_later"/);
assert.match(controlPlane, /createEstimate/);
assert.match(controlPlane, /reserveRun/);
assert.match(controlPlane, /settleRunFromBroker/);
assert.match(controlPlane, /failRunFromBroker/);

console.log(JSON.stringify({ suite: "ai-assistance-truth", passed: 12, total: 12 }));
