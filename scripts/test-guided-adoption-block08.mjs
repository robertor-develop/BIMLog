import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(path, "utf8");
const contract = read("artifacts/api-server/src/lib/dashboard-adoption-summary.ts");
const route = read("artifacts/api-server/src/routes/dashboard_briefing.ts");
const destination = read("artifacts/bimlog/src/lib/assigned-item-destination.ts");
const dashboard = read("artifacts/bimlog/src/pages/Dashboard.tsx");

for (const token of ["id: number", "row.id > 0"]) assert.ok(contract.includes(token), token);
for (const token of ["id: rfisTable.id", "id: submittalsTable.id", 'kind: "rfi" as const, id: row.id', 'kind: "submittal" as const, id: row.id']) assert.ok(route.includes(token), token);
for (const token of ['new URLSearchParams', '"rfi" : "submittal"', "Number.isInteger(item.id)"]) assert.ok(destination.includes(token), token);
assert.ok(dashboard.includes("assignedItemDestination(item)"));
assert.ok(dashboard.includes("chooseRoleAwareTodayAction"), "role-aware priority remains authoritative");
console.log("Simplification and guided adoption Block 8 acceptance: PASS");
