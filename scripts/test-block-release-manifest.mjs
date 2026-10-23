import assert from "node:assert/strict";
import { validateBlockReleaseManifest } from "./block-release-manifest.mjs";

const valid = {
  schemaVersion: "bimlog-block-release-manifest-v1",
  source: { commit: "a".repeat(40), tree: "b".repeat(40), clean: true },
  migrationSet: { sha256: "c".repeat(64), schemaAction: "NONE" },
  rollback: { targetCommit: "d".repeat(40) },
  acceptance: { authenticatedChrome: "REQUIRED_AFTER_PUBLICATION" },
  publication: { provider: "Replit" },
};
assert.deepEqual(validateBlockReleaseManifest(valid), { ok: true, errors: [] });
for (const mutate of [
  (value) => { value.source.clean = false; },
  (value) => { value.source.commit = "latest"; },
  (value) => { value.migrationSet.schemaAction = "UNKNOWN"; },
  (value) => { value.acceptance.authenticatedChrome = "SKIPPED"; },
]) {
  const candidate = structuredClone(valid); mutate(candidate); assert.equal(validateBlockReleaseManifest(candidate).ok, false);
}
console.log("BLOCK_RELEASE_MANIFEST=PASS exact_source=true migration=true rollback=true authenticated_acceptance=true");
