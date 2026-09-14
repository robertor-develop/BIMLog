import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.join(import.meta.dirname, "JobIntakeWorkspace.tsx"), "utf8");

assert.match(source, /stageMissingCodes/);
assert.match(source, /What remains for this section/);
assert.match(source, /The contract fields are complete\. Confirm them in Review & Activate/);
assert.match(source, /The delivery fields are complete\. Confirm the delivery workflow in Review & Activate/);
assert.match(source, /openFinalReview/);
assert.match(source, /preserveActiveStage\(projectId, "review"\)/);

console.log(JSON.stringify({ status: "PASS", build: 6, checks: ["contract-inline-missing", "delivery-inline-missing", "final-confirmation-navigation"] }));
