import assert from "node:assert/strict";
import { FEEDBACK_MAX_FILE_BYTES, FEEDBACK_RELEASE, FeedbackEvidenceError, inspectFeedbackEvidence, sanitizeFeedbackFilename } from "./feedback-evidence-contract";

assert.equal(FEEDBACK_RELEASE, "v1.60.35.10-F");
assert.equal(sanitizeFeedbackFilename("../../evil<script>.pdf"), "evil_script_.pdf");
const pdf = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF");
assert.equal(inspectFeedbackEvidence({ originalname: "proof.pdf", size: pdf.length, buffer: pdf }).name, "proof.pdf");
assert.throws(() => inspectFeedbackEvidence({ originalname: "fake.pdf", size: 4, buffer: Buffer.from("MZ!!") }), (error: unknown) => error instanceof FeedbackEvidenceError && error.code === "FEEDBACK_FILE_SIGNATURE_MISMATCH");
assert.throws(() => inspectFeedbackEvidence({ originalname: "payload.exe", size: 2, buffer: Buffer.from("MZ") }), (error: unknown) => error instanceof FeedbackEvidenceError && error.code === "FEEDBACK_FILE_TYPE_REJECTED");
assert.throws(() => inspectFeedbackEvidence({ originalname: "large.txt", size: FEEDBACK_MAX_FILE_BYTES + 1, buffer: Buffer.from("x") }), (error: unknown) => error instanceof FeedbackEvidenceError && error.code === "FEEDBACK_FILE_SIZE_REJECTED");
assert.throws(() => inspectFeedbackEvidence({ originalname: "binary.txt", size: 3, buffer: Buffer.from([1, 0, 2]) }), (error: unknown) => error instanceof FeedbackEvidenceError && error.code === "FEEDBACK_FILE_SIGNATURE_MISMATCH");
assert.throws(() => inspectFeedbackEvidence({ originalname: "macro.docx", size: 64, buffer: Buffer.from("PK\u0003\u0004[Content_Types].xml word/vbaProject.bin") }), (error: unknown) => error instanceof FeedbackEvidenceError && error.code === "FEEDBACK_OOXML_UNSAFE");
console.log("feedback evidence contract: 8/8 passed");
