import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const inventory = await readFile(new URL("./project-retirement-inventory.ts", import.meta.url), "utf8");
const retirement = await readFile(new URL("./project-retirement.ts", import.meta.url), "utf8");

for (const key of ["memberships", "files", "rfis", "submittals", "lensViewpoints", "jobIntakes", "contracts", "projectApus", "budgets", "meetings", "transmittals", "changeOrders", "activityEvents"]) {
  assert.match(inventory, new RegExp(`\\[\\"${key}\\"`), `${key} must be inventoried`);
}
assert.match(retirement, /recordCounts, totalInventoriedRecords:/);
for (const protectedAuthority of ["APU library templates", "delivery workflow templates", "workflow governance policies", "company catalogs", "internal cost policies"]) {
  assert.match(inventory, new RegExp(protectedAuthority), `${protectedAuthority} must be classified as company-owned and unaffected`);
}
assert.match(inventory, /retirementEffect: "preserved_read_only"/);
assert.match(inventory, /retirementEffect: "unaffected"/);
assert.match(retirement, /export async function restoreProject/);
assert.match(retirement, /action: "restore_project"/);
assert.match(retirement, /eq\(projectsTable\.status, "archived"\)/);
console.log("PASS project retirement dependency inventory");
