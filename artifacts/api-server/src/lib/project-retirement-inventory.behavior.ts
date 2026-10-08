import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const inventory = await readFile(new URL("./project-retirement-inventory.ts", import.meta.url), "utf8");
const retirement = await readFile(new URL("./project-retirement.ts", import.meta.url), "utf8");

for (const key of ["memberships", "files", "rfis", "submittals", "lensViewpoints", "jobIntakes", "contracts", "projectApus", "budgets", "meetings", "transmittals", "changeOrders", "activityEvents"]) {
  assert.match(inventory, new RegExp(`\\[\\"${key}\\"`), `${key} must be inventoried`);
}
assert.match(retirement, /recordCounts, totalInventoriedRecords:/);
console.log("PASS project retirement dependency inventory");
