import assert from "node:assert/strict";
import path from "node:path";
import { approvedProofBase, resolveProofRoot } from "./proof-root.mjs";

const feedback = resolveProofRoot("feedback-proof");
const workflow = resolveProofRoot("workflow-proof");
assert.equal(feedback, path.join(approvedProofBase, "feedback-proof"));
assert.equal(workflow, path.join(approvedProofBase, "workflow-proof"));
assert.notEqual(feedback, workflow);
assert.throws(() => resolveProofRoot("../escape"), /bounded lowercase/);
assert.throws(() => resolveProofRoot("workflow-proof", path.resolve(approvedProofBase, "..", "escape")), /escaped/);
console.log(`PROOF_ROOTS=PASS base=${approvedProofBase} purposes=feedback-proof,workflow-proof`);
