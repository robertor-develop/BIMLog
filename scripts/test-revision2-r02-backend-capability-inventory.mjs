import assert from "node:assert/strict";
import fs from "node:fs";

const graph = JSON.parse(fs.readFileSync(new URL("../evidence/stabilization-program-20260919/ROUTE_INTERCONNECTION_GRAPH.json", import.meta.url)));
const inventory = JSON.parse(fs.readFileSync(new URL("../evidence/revision2-r01-r05/R02_BACKEND_CAPABILITY_INVENTORY.json", import.meta.url)));
const expected = graph.apiRoutes.map(({ method, path }) => `${method} ${path}`).sort();
const actual = inventory.routes.map(({ identity }) => identity).sort();

assert.deepEqual(actual, expected, "inventory must cover every governed backend route exactly");
assert.equal(new Set(actual).size, actual.length, "backend route identities must be unique");
assert.equal(inventory.counts.routes, expected.length);
assert.ok(inventory.routes.every(({ owner, capabilityGroup, authorizationClass, frontendRequirement, evidenceStatus }) =>
  owner && capabilityGroup && authorizationClass && frontendRequirement && evidenceStatus));
assert.ok(inventory.routes.every(({ frontendRequirement }) => frontendRequirement.includes("required")));
assert.ok(inventory.routes.some(({ authorizationClass }) => authorizationClass === "administrator_namespace"));
assert.ok(inventory.routes.some(({ authorizationClass }) => authorizationClass === "project_scoped_namespace"));
assert.equal(inventory.productRule, "preserve_capability_and_require_intentional_discoverable_exposure");

console.log(`REVISION2_R02=PASS routes=${actual.length} owners=${inventory.counts.owners} groups=${inventory.counts.capabilityGroups} tables=${inventory.counts.persistenceTables}`);
