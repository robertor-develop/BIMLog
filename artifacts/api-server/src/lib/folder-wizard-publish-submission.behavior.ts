import assert from "node:assert/strict";
import { FolderWizardPublishSubmission } from "./folder-wizard-publish-submission";

const digest = "a".repeat(64);
let enqueued = 0;
const candidate = { prepare: async () => ({ preview: { ready: true as const, blockers: [], fileId: 7, filename: "proof.txt",
    byteSize: 5, siteUrl: "https://test.sharepoint.com/sites/qa", driveRelativePath: "SHOP/proof.txt",
    requestDigest: digest, publicationState: "not_submitted" as const },
    plan: { requestDigest: digest, idempotencyKey: digest, driveRelativePath: "SHOP/proof.txt",
      filename: "proof.txt", tags: {}, sourceFileId: 7, sourceSha256: digest, sourceBytes: 5,
      importId: "import-1", profileFingerprint: digest, credentialId: "credential-1", siteId: "site-1",
      libraryId: "library-1", siteUrl: "https://test.sharepoint.com/sites/qa" } }) };
const queue = { enqueue: async (job: { id: string; companyId: number; requestDigest: string }) => {
  enqueued++; assert.equal(job.companyId, 3); assert.equal(job.requestDigest, digest);
  return { jobId: job.id, result: "queued" as const }; } };
const service = new FolderWizardPublishSubmission(candidate, queue, async () => 3);
const input = { projectId: 5, actorUserId: 2, fileId: 7, tags: {}, expectedDigest: digest,
  confirmation: "publish_sharepoint" as const };
assert.equal((await service.submit(input)).result, "queued");
assert.equal(enqueued, 1);
await assert.rejects(service.submit({ ...input, confirmation: "wrong" as never }), /PUBLISH_CONFIRMATION_REQUIRED/);
await assert.rejects(service.submit({ ...input, expectedDigest: "b".repeat(64) }), /PUBLISH_PREVIEW_STALE/);
const denied = new FolderWizardPublishSubmission(candidate, queue, async () => {
  throw new Error("FOLDER_WIZARD_FORBIDDEN");
});
await assert.rejects(denied.submit(input), /FORBIDDEN/);
assert.equal(enqueued, 1);
console.log("Folder Wizard explicit digest-bound submission: PASS");
