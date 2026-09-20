import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { validateFinalReleaseCandidate } from "./block24-final-release-contract";

const root = path.resolve(process.cwd(), "../..");
const commit = "a".repeat(40), tree = "b".repeat(40);
const packages = [2021, 2025].map((year) => {
  const sidecar = path.join(root, `plugins/BIMLogLensNext/BIMLog-Lens-Next-Navisworks${year}-v1.05.N18-P36.zip.sha256`);
  return { year: year as 2021 | 2025, sha256: fs.readFileSync(sidecar, "utf8").trim().split(/\s+/)[0] };
});
assert.deepEqual(validateFinalReleaseCandidate({ release: "v1.05.N18-P36", sourceCommit: commit, sourceTree: tree, databaseAction: "NONE", destructiveStatements: 0, provider: "replit", replitAgentsUsed: false, packages }), []);
assert.ok(validateFinalReleaseCandidate({ release: "v1.05.N18-P36", sourceCommit: commit, sourceTree: tree, databaseAction: "NONE", destructiveStatements: 1, provider: "replit", replitAgentsUsed: false, packages }).length > 0);
console.log("block24 build116 exact manifest and zero-mutation release plan: PASS");
