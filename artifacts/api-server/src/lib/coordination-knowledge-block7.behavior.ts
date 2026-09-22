import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assertResolutionRecordTransition } from "./coordination-resolution-record-contract";

const here=import.meta.dirname,repository=readFileSync(join(here,"coordination-knowledge-repository.ts"),"utf8"),routes=readFileSync(join(here,"../routes/coordination-knowledge.ts"),"utf8"),panel=readFileSync(join(here,"../../../bimlog/src/features/lens-next/LensNextResolutionPanel.tsx"),"utf8"),controller=readFileSync(join(here,"../../../bimlog/src/features/lens-next/LensNextPanel.tsx"),"utf8");
for(const endpoint of ["/resolution\"","/resolution/evidence\"","/resolution/${action}"])assert.ok(routes.includes(endpoint),`missing ${endpoint}`);
assert.match(routes,/context\(req,"document_outcome"\)/);
assert.match(routes,/action==="verify"\?"review":"document_outcome"/);
assert.match(repository,/assertCanonicalIssueScope/);
assert.match(repository,/status='approved'/);
assert.match(repository,/KNOWLEDGE_VERSION_CONFLICT/);
assert.match(repository,/RESOLUTION_VERIFIER_MUST_BE_INDEPENDENT/);
assert.match(controller,/Promise\.all\(\[apiClient\.loadResolutionRecord/);
assert.match(panel,/Before \/ after evidence/);
assert.match(panel,/Upload project evidence in the BIMLog issue tab/);
assert.doesNotThrow(()=>assertResolutionRecordTransition(null,"completed",null));
assert.throws(()=>assertResolutionRecordTransition("verified","completed",null));
console.log("Build 260 Coordination Knowledge Block 7 integration: PASS");
