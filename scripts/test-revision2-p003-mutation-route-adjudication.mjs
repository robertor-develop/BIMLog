import assert from "node:assert/strict";
import fs from "node:fs";

const backend = JSON.parse(fs.readFileSync(new URL("../evidence/revision2-r01-r05/R02_BACKEND_CAPABILITY_INVENTORY.json", import.meta.url)));
const result = JSON.parse(fs.readFileSync(new URL("../evidence/revision2-p001-p005/P003_MUTATION_ROUTE_ADJUDICATION.json", import.meta.url)));
const mutations = backend.routes.filter(({ method }) => method !== "GET");
assert.equal(result.entries.length, mutations.length);
assert.equal(new Set(result.entries.map(({ backendIdentity }) => backendIdentity)).size, mutations.length);
assert.ok(result.entries.every(({ visibleStates }) => ["permission", "success", "error", "evidence"].every((key) => typeof visibleStates[key] === "boolean")));
assert.ok(result.entries.every(({ missingVisibleStates, visibleStates }) => missingVisibleStates.length === Object.values(visibleStates).filter((value) => !value).length));
assert.ok(result.entries.filter(({ disposition }) => disposition === "missing-frontend").every(({ productGap }) => productGap));
assert.ok(result.entries.every(({ noCapabilityLossRule }) => noCapabilityLossRule.includes("retain-mutation")));
console.log(`REVISION2_P003=PASS mutations=${mutations.length} referenced=${result.counts.withFrontendReference} gaps=${result.counts.productGaps}`);
