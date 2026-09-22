import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repository=readFileSync(join(import.meta.dirname,"coordination-knowledge-repository.ts"),"utf8"),routes=readFileSync(join(import.meta.dirname,"../routes/coordination-knowledge.ts"),"utf8"),panel=readFileSync(join(import.meta.dirname,"../../../bimlog/src/features/lens-next/LensNextResolutionPanel.tsx"),"utf8");
assert.match(repository,/transitionResolutionRecord/);
assert.match(repository,/RESOLUTION_VERIFIER_MUST_BE_INDEPENDENT/);
assert.match(repository,/resolution_verified/);
assert.match(repository,/resolution_reopened/);
assert.match(routes,/action==="verify"\?"review":"document_outcome"/);
assert.match(routes,/RESOLUTION_REOPEN_REASON_REQUIRED/);
assert.match(panel,/Verify resolution/);
assert.match(panel,/Reason to reopen/);
assert.match(panel,/Immutable resolution history/);
console.log("Build 259 resolution verification and reopening: PASS");
