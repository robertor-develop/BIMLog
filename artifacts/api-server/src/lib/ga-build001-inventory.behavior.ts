import assert from "node:assert/strict";
import { GA_PROTECTED_PROJECTS, gaProtectedProjectById, isGaProtectedProjectId, requireGaProjectNotProtected } from "./ga-protected-projects";

assert.deepEqual(GA_PROTECTED_PROJECTS.map(project => project.id).sort((a, b) => a - b), [23, 26, 35]);
assert.equal(gaProtectedProjectById(23)?.code, "IBQ-LIT");
assert.equal(gaProtectedProjectById(26)?.code, "ELA01");
assert.equal(gaProtectedProjectById(35)?.code, "PRO-521-TEST");
assert.equal(isGaProtectedProjectId(64), false);
assert.throws(() => requireGaProjectNotProtected(23), /GA_PROTECTED_PROJECT:23/);
assert.doesNotThrow(() => requireGaProjectNotProtected(64));

console.log("B_GA001=PASS protectedIds=23,26,35 cleanupFrozen=true");
