import assert from "node:assert/strict";
import { createRuntimeReleaseIdentity } from "./runtime-release-identity.mjs";

const input = { release: "v1.05.N18-P38", commit: "a".repeat(40), tree: "b".repeat(40), manifestSha256: "c".repeat(64), migrationLevel: "schema-test" };
const first = createRuntimeReleaseIdentity(input);
assert.deepEqual(first, createRuntimeReleaseIdentity(input));
assert.match(first.packageId, /^bimlog-a{16}-c{16}$/);
assert.equal(first.identityBound, true);
for (const field of ["commit", "tree", "manifestSha256", "migrationLevel"]) {
  const changed = { ...input, [field]: field === "migrationLevel" ? "schema-next" : (field === "manifestSha256" ? "d".repeat(64) : "d".repeat(40)) };
  assert.notEqual(createRuntimeReleaseIdentity(changed).identityFingerprint, first.identityFingerprint);
}
console.log("RUNTIME_RELEASE_IDENTITY=PASS");
