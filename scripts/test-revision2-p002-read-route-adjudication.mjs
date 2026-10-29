import assert from "node:assert/strict";
import fs from "node:fs";

const backend = JSON.parse(fs.readFileSync(new URL("../evidence/revision2-r01-r05/R02_BACKEND_CAPABILITY_INVENTORY.json", import.meta.url)));
const result = JSON.parse(fs.readFileSync(new URL("../evidence/revision2-p001-p005/P002_READ_ROUTE_ADJUDICATION.json", import.meta.url)));
const reads = backend.routes.filter(({ method }) => method === "GET");
assert.equal(result.entries.length, reads.length);
assert.equal(new Set(result.entries.map(({ backendIdentity }) => backendIdentity)).size, reads.length);
assert.ok(result.entries.every(({ disposition }) => result.dispositions.includes(disposition)));
assert.ok(result.entries.every(({ noCapabilityLossRule }) => noCapabilityLossRule.startsWith("retain-route")));
assert.ok(result.entries.filter(({ productGap }) => productGap).every(({ frontendReferences }) => frontendReferences.length === 0));
assert.ok(result.entries.filter(({ frontendReferences }) => frontendReferences.length).every(({ operability }) => operability === "frontend-entry-evidenced"));
console.log(`REVISION2_P002=PASS reads=${reads.length} gaps=${result.counts.productGaps}`);
