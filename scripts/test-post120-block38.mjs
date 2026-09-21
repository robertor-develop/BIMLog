import assert from "node:assert/strict";
import fs from "node:fs";

const read = relative => fs.readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");
const openLoop = read("living-brief/OPEN_LOOP.md");
const inventory = JSON.parse(read("living-brief/OPEN_LOOP_DISPOSITIONS.json"));

assert.equal(inventory.schemaVersion, 2, "open-loop inventory uses the typed ownership contract");
assert.equal((openLoop.match(/CURRENT_OPEN_LOOP_AUTHORITY/g) ?? []).length, 1, "exactly one current authority marker exists");
assert.equal(inventory.currentAuthority.heading, "Current open-loop authority — post-120 Block 44 — 2026-09-21");
assert.equal(inventory.currentAuthority.uncheckedItems.length, 3, "current authority preserves Build 220 publication plus physical 2021 remediation and deferred 2025 field evidence");
assert.deepEqual(inventory.duplicateStatements, [], "duplicate unchecked statements are prohibited");
assert.equal(inventory.reconciledDuplicateGroups.length, 7, "all seven discovered historical duplicate loops remain explicitly reconciled");

const allowed = new Set(["PRODUCT_WORK", "FIELD_EVIDENCE", "PROVIDER_EVIDENCE", "STALE_CONTRADICTION"]);
for (const item of inventory.items) {
  assert.ok(allowed.has(item.workClass), `${item.id} has a governed work class`);
  assert.ok(item.ownership.owner && item.ownership.module, `${item.id} has an owner/module binding`);
  if (item.workClass === "PRODUCT_WORK") assert.ok(item.ownership.route, `${item.id} product work has an owning route`);
  if (item.workClass === "STALE_CONTRADICTION") assert.notEqual(item.classification, "ACTIVE", `${item.id} stale contradiction cannot remain active`);
}

const currentItems = inventory.items.filter(item => item.currentAuthority);
assert.equal(currentItems.filter(item => item.workClass === "PROVIDER_EVIDENCE").length, 1, "only Build 220 publication remains current provider work");
assert.ok(currentItems.some(item => item.statement.includes("Build 220") && item.workClass === "PROVIDER_EVIDENCE"), "Build 220 publication is the current provider boundary");
assert.equal(currentItems.filter(item => item.workClass === "FIELD_EVIDENCE").length, 2, "2021 remediation and Ruben's 2025 confirmation remain current field evidence");
assert.ok(inventory.items.some(item => item.statement.includes("Build 160") && item.workClass === "STALE_CONTRADICTION"), "obsolete Build 160 publication marker is closed");
assert.ok(inventory.items.some(item => item.statement.includes("Builds 166–170") && item.workClass === "STALE_CONTRADICTION"), "obsolete Build 170 marker is closed");

console.log(`POST120_BLOCK38=PASS items=${inventory.itemCount} product=${inventory.items.filter(item => item.workClass === "PRODUCT_WORK").length} field=${inventory.items.filter(item => item.workClass === "FIELD_EVIDENCE").length} provider=${inventory.items.filter(item => item.workClass === "PROVIDER_EVIDENCE").length} stale=${inventory.items.filter(item => item.workClass === "STALE_CONTRADICTION").length}`);
