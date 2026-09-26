import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./local-release-gate.mjs", import.meta.url), "utf8");
for (const id of ["proof-roots", "workflow-database-fixture", "platform-audit-policy", "invitation-transactions", "pre-push"]) assert.match(source, new RegExp(`id: "${id}"`));
assert.match(source, /status", "--porcelain"/);
assert.match(source, /exactlyOnce: true/);
assert.match(source, /receiptSha256/);
assert.match(source, /flag: "wx"/);
console.log("LOCAL_RELEASE_GATE_CONTRACT=PASS commands=5 exactlyOnce=true receipt=sha256");
