import assert from "node:assert/strict";
import fs from "node:fs";

const journeys = JSON.parse(fs.readFileSync(new URL("../evidence/revision2-r01-r05/R04_USER_JOURNEY_RECONCILIATION.json", import.meta.url)));
const program = JSON.parse(fs.readFileSync(new URL("../evidence/revision2-r01-r05/R05_EXACT_IMPLEMENTATION_PROGRAM.json", import.meta.url)));
const knownGaps = new Set(journeys.implementationCandidates.map(({ id }) => id));

assert.equal(program.buildCount, 20);
assert.equal(program.blockCount, 4);
assert.equal(program.buildsPerBlock, 5);
assert.deepEqual(program.builds.map(({ id }) => id), Array.from({ length: 20 }, (_, index) => `P${String(index + 1).padStart(3, "0")}`));
assert.deepEqual([...new Set(program.builds.map(({ block }) => block))], [1, 2, 3, 4]);
assert.ok(program.builds.every(({ gaps }) => gaps.every((gap) => knownGaps.has(gap))));
assert.ok(program.builds.every(({ protectedBehavior }) => protectedBehavior.includes("preserve_all_legitimate_capabilities")));
assert.deepEqual(program.builds.filter(({ publicationBoundary }) => publicationBoundary).map(({ id }) => id), ["P010", "P020"]);
assert.ok(program.prohibitedStrategies.includes("no_module_deletion"));
assert.ok(program.prohibitedStrategies.includes("no_vague_more_menu_for_functional_pages"));
assert.ok(program.exitGate.includes("novice plus expert acceptance"));

console.log(`REVISION2_R05=PASS builds=${program.buildCount} blocks=${program.blockCount} firstPublication=P010 final=P020`);
