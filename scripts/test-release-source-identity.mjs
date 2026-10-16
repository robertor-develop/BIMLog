import assert from "node:assert/strict";
import { validateSourceIdentity } from "./release-source-identity.mjs";

const valid = { branch: "codex/release", upstream: "origin/codex/release", commit: "a".repeat(40), tree: "b".repeat(40), ahead: 0, behind: 0, dirtyPaths: [] };
assert.equal(validateSourceIdentity(valid).ok, true);
for (const change of [
  { upstream: "origin/main" }, { ahead: 1 }, { behind: 1 }, { dirtyPaths: [" M file"] }, { commit: "short" },
]) assert.equal(validateSourceIdentity({ ...valid, ...change }).ok, false);
console.log("RELEASE_SOURCE_IDENTITY=PASS");
