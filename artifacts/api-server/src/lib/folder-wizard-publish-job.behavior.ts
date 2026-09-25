import assert from "node:assert/strict";
import { createFolderWizardPublishJob } from "./folder-wizard-publish-job";

const plan = { requestDigest: "a".repeat(64), idempotencyKey: "a".repeat(64),
  driveRelativePath: "SHOP/proof.txt", filename: "proof.txt", sourceFileId: 8,
  sourceSha256: "b".repeat(64), sourceBytes: 16, importId: "import-1",
  profileFingerprint: "c".repeat(64), credentialId: "credential-1", siteId: "site-1",
  libraryId: "drive-1", siteUrl: "https://bimtech.sharepoint.com/sites/qa" };
const job = createFolderWizardPublishJob({ companyId: 3, projectId: 5, actorUserId: 2, plan, jobId: "job-0001" });
assert.equal(job.idempotencyKey, job.requestDigest);
assert.equal(job.payload.sourceSha256, plan.sourceSha256);
assert.equal(job.payload.driveRelativePath, "SHOP/proof.txt");
assert.equal(JSON.stringify(job).includes("token"), false);
assert.throws(() => createFolderWizardPublishJob({ companyId: 3, projectId: 5, actorUserId: 2,
  plan: { ...plan, idempotencyKey: "d".repeat(64) } }), /JOB_INVALID/);
assert.throws(() => createFolderWizardPublishJob({ companyId: 3, projectId: 5, actorUserId: 2,
  plan: { ...plan, driveRelativePath: "SHOP/other.txt" } }), /JOB_INVALID/);
console.log("Folder Wizard frozen publish job: PASS");
