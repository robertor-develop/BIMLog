import assert from "node:assert/strict";
import fs from "node:fs";

const backend = JSON.parse(fs.readFileSync(new URL("../evidence/revision2-r01-r05/R02_BACKEND_CAPABILITY_INVENTORY.json", import.meta.url)));
const result = JSON.parse(fs.readFileSync(new URL("../evidence/revision2-p001-p005/P004_ROUTE_FAMILY_MODULE_RECONCILIATION.json", import.meta.url)));
const identities = result.families.flatMap(({ routeIdentities }) => routeIdentities);
assert.equal(identities.length, backend.routes.length);
assert.equal(new Set(identities).size, backend.routes.length);
assert.deepEqual(new Set(identities), new Set(backend.routes.map(({ identity }) => identity)));
assert.equal(result.modules.reduce((sum, module) => sum + module.routeCount, 0), backend.routes.length);
assert.ok(result.modules.every(({ preserveDistinctOwners }) => preserveDistinctOwners));
assert.ok(result.families.every(({ reconciliationRule }) => reconciliationRule.includes("without-merging")));
assert.ok(result.counts.sharedServiceFamilies > 0, "shared services must be identified without collapsing their owners");
console.log(`REVISION2_P004=PASS routes=${identities.length} families=${result.counts.families} modules=${result.counts.modules}`);
