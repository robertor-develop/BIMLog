import assert from "node:assert/strict";
import { validateCandidateIdentity } from "./lib/candidate-identity.mjs";
const base={schemaVersion:"bimlog-web-candidate-identity-v1",source:{head:"a".repeat(40),tree:"b".repeat(40),clean:true},digests:{packageJsonSha256:"c".repeat(64),lockfileSha256:"d".repeat(64),migrationSetSha256:"e".repeat(64)},database:{preview:"PASS"},rollback:{sourceSha:"f".repeat(40)},deployment:{identity:"UNTESTED"}};
assert.equal(validateCandidateIdentity(base).valid,true);
for(const mutation of [
  {...base,source:{...base.source,clean:false}},
  {...base,database:{preview:"UNTESTED"}},
  {...base,digests:{...base.digests,lockfileSha256:"bad"}},
  {...base,rollback:{sourceSha:"bad"}},
  {...base,deployment:{identity:"PASS"}}
]) assert.equal(validateCandidateIdentity(mutation).valid,false);
console.log("CORRECTIVE-B04 identity contract PASS: dirty/digest/database/rollback/deployment contradictions fail closed");
