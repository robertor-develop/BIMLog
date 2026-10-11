import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(path, "utf8");
const route = read("artifacts/api-server/src/routes/dashboard_briefing.ts");
const contract = read("artifacts/api-server/src/lib/dashboard-adoption-summary.ts");
const client = read("artifacts/bimlog/src/lib/dashboard-adoption-summary.ts");
const dashboard = read("artifacts/bimlog/src/pages/Dashboard.tsx");
const today = read("artifacts/bimlog/src/components/dashboard/TodayWorkspace.tsx");
assert.match(contract, /MAX_ACTIVITY = 15/);
assert.match(route, /\/dashboard\/adoption-summary/);
assert.match(route, /getScopedProjectIds\(req\.user!\.userId\)/);
assert.match(client, /HEADQUARTERS_SUMMARY_UNAVAILABLE/);
assert.match(dashboard, /loadDashboardAdoptionSummary/);
assert.doesNotMatch(dashboard, /Promise\.all\([\s\S]{0,400}\/rfis[\s\S]{0,400}\/submittals[\s\S]{0,400}\/activity[\s\S]{0,400}\/files/);
for (const token of ["adoptionSummaryFailed", "@media (max-width: 720px)"]) assert.ok(dashboard.includes(token), token);
for (const token of ["role=\"alert\"", "Try again", "Intentar de nuevo"]) assert.ok(today.includes(token), token);
console.log("Simplification and guided adoption Block 6 acceptance: PASS");
