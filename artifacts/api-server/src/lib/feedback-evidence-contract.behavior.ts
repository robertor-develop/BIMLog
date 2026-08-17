import assert from "node:assert/strict";
import { FEEDBACK_MAX_FILE_BYTES, FEEDBACK_RELEASE, FeedbackEvidenceError, inspectFeedbackEvidence, sanitizeFeedbackFilename } from "./feedback-evidence-contract";

assert.equal(FEEDBACK_RELEASE, "v F-1.60.35.8");
assert.equal(sanitizeFeedbackFilename("../../evil<script>.pdf"), "evil_script_.pdf");
assert.equal(inspectFeedbackEvidence({ originalname: "proof.pdf", size: 8, buffer: Buffer.from("%PDF-1.7") }).name, "proof.pdf");
assert.throws(() => inspectFeedbackEvidence({ originalname: "fake.pdf", size: 4, buffer: Buffer.from("MZ!!") }), (error: unknown) => error instanceof FeedbackEvidenceError && error.code === "FEEDBACK_FILE_SIGNATURE_MISMATCH");
assert.throws(() => inspectFeedbackEvidence({ originalname: "payload.exe", size: 2, buffer: Buffer.from("MZ") }), (error: unknown) => error instanceof FeedbackEvidenceError && error.code === "FEEDBACK_FILE_TYPE_REJECTED");
assert.throws(() => inspectFeedbackEvidence({ originalname: "large.txt", size: FEEDBACK_MAX_FILE_BYTES + 1, buffer: Buffer.from("x") }), (error: unknown) => error instanceof FeedbackEvidenceError && error.code === "FEEDBACK_FILE_SIZE_REJECTED");
assert.throws(() => inspectFeedbackEvidence({ originalname: "binary.txt", size: 3, buffer: Buffer.from([1, 0, 2]) }), (error: unknown) => error instanceof FeedbackEvidenceError && error.code === "FEEDBACK_FILE_SIGNATURE_MISMATCH");
console.log("feedback evidence contract: 7/7 passed");
