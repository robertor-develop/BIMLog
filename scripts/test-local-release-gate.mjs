import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./local-release-gate.mjs", import.meta.url), "utf8");
for (const id of ["proof-roots", "workflow-database-fixture", "platform-audit-policy", "submittal-register-coverage", "invitation-transactions", "pre-push"]) assert.match(source, new RegExp(`id: "${id}"`));
assert.match(source, /id: "integration-presentation"/);
assert.match(source, /id: "governance-runtime"/);
assert.match(source, /status", "--porcelain"/);
assert.match(source, /exactlyOnce: true/);
assert.match(source, /receiptSha256/);
assert.match(source, /flag: "wx"/);
const statePreparation = fs.readFileSync(new URL("./update-living-brief-state.mjs", import.meta.url), "utf8");
const generationIndex = statePreparation.indexOf('"generate:platform"');
assert.ok(generationIndex >= 0, "State preparation must refresh the API platform inventory");
assert.ok(generationIndex < statePreparation.indexOf("const changedPaths ="), "Generate before capturing reviewed paths");
assert.ok(generationIndex < statePreparation.indexOf("const documents ="), "Generate before hashing documents");
console.log("LOCAL_RELEASE_GATE_CONTRACT=PASS commands=8 exactlyOnce=true receipt=sha256");
