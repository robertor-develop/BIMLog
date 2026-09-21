import assert from "node:assert/strict";
import { classifyVisualPackageTruth, presentLensReferenceAttachment, requireCompleteVisualPackage } from "./clash-visual-package-truth";

assert.deepEqual(classifyVisualPackageTruth({}), { state: "absent", available: false, digest: null });
assert.deepEqual(classifyVisualPackageTruth({ visualStateJson: "{}", visualStateDigest: "a".repeat(64) }), { state: "complete", available: true, digest: "a".repeat(64) });
assert.equal(classifyVisualPackageTruth({ visualStateJson: "{}" }).state, "invalid_partial");
assert.equal(classifyVisualPackageTruth({ visualStateDigest: "a".repeat(64) }).state, "invalid_partial");
assert.throws(() => requireCompleteVisualPackage({ visualStateJson: "{}" }), /VISUAL_PACKAGE_PARTIAL/);
assert.equal(requireCompleteVisualPackage({ visualStateJson: "{}", visualStateDigest: "B".repeat(64) }).visualStateDigest, "b".repeat(64));

const attachment = presentLensReferenceAttachment(7, { linkId: 1, fileId: 9, fileName: "detail.pdf", fileSize: null, mimeType: "application/pdf", createdAt: null });
assert.equal(attachment.fileSize, 0);
assert.equal(attachment.downloadUrl, "/api/v1/projects/7/files/9/download");
assert.throws(() => presentLensReferenceAttachment(0, { ...attachment, createdAt: null }), /REFERENCE_IDENTITY_INVALID/);

console.log("POST120_BUILD163=PASS visual=fail_closed references=project_scoped presentation=stable");
