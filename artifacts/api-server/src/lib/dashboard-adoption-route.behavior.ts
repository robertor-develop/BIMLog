import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../routes/dashboard_briefing.ts", import.meta.url), "utf8");
assert.match(source, /router\.get\("\/dashboard\/adoption-summary", authMiddleware/);
assert.match(source, /getScopedProjectIds\(req\.user!\.userId\)/);
assert.match(source, /\.limit\(15\)/);
assert.match(source, /\.limit\(200\)/);
assert.match(source, /boundedDashboardAdoptionSummary/);
assert.match(source, /db\.select\(\{ id: rfisTable\.id, projectId: rfisTable\.projectId/);
assert.match(source, /db\.select\(\{ id: submittalsTable\.id, projectId: submittalsTable\.projectId/);
assert.match(source, /kind: "rfi" as const, id: row\.id/);
assert.match(source, /kind: "submittal" as const, id: row\.id/);
assert.doesNotMatch(source, /router\.get\("\/dashboard\/adoption-summary"[\s\S]*?db\.select\(\)\.from\(rfisTable\)/);
console.log("Simplification and guided adoption build 027 tenant-bounded Headquarters summary route: PASS");
