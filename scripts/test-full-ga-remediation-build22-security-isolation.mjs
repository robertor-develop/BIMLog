import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runNodeGate, runTsGate } from "./lib/observable-gate-runner.mjs";

runNodeGate("scripts/test-ga-final-block01-build001-agent-access.mjs");
runNodeGate("scripts/test-ga-final-block01-build002-agent-isolation.mjs");
for (const file of [
  "artifacts/api-server/src/lib/block22-build106-object-authorization.behavior.ts",
  "artifacts/api-server/src/lib/consolidation-build116-role-isolation.behavior.ts",
  "artifacts/api-server/src/lib/coordination-knowledge-authorization.behavior.ts",
  "artifacts/api-server/src/lib/post120-build208-authorization-negative-matrix.behavior.ts",
]) runTsGate(file);

const protectedProjects = readFileSync("artifacts/api-server/src/lib/ga-protected-projects.ts", "utf8");
for (const code of ["PRO-521-TEST", "ELA01", "IBQ-LIT"]) {
  assert.ok(protectedProjects.includes(code), `protected project identity missing ${code}`);
}

const purge = readFileSync("scripts/ga-production-purge.mts", "utf8");
assert.match(purge, /SERIALIZABLE/);
assert.match(purge, /ROBERTOS_EXACT_SAMPLE_PURGE/);
assert.doesNotMatch(purge, /TRUNCATE|DROP\s+TABLE|CASCADE/i);

console.log("Full-GA Block 5 Build 22 tenant, role, object and protected-project isolation: PASS");
