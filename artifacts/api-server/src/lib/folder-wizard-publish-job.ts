import { randomUUID } from "node:crypto";
import type { FolderWizardPublishPlan } from "./folder-wizard-publish-plan";

export type FolderWizardPublishJob = {
  id: string; companyId: number; projectId: number; actorUserId: number;
  credentialId: string; provider: "sharepoint"; jobType: "publish";
  idempotencyKey: string; requestDigest: string; maxAttempts: 5;
  payload: {
    kind: "folder_wizard_file_v1"; importId: string; profileFingerprint: string;
    sourceFileId: number; sourceSha256: string; sourceBytes: number;
    siteId: string; libraryId: string; siteUrl: string; driveRelativePath: string; filename: string;
  };
};

/** A job contains immutable routing identity, never file bytes or a provider credential. */
export function createFolderWizardPublishJob(input: {
  companyId: number; projectId: number; actorUserId: number; plan: FolderWizardPublishPlan;
  jobId?: string;
}): FolderWizardPublishJob {
  const { plan } = input;
  if (![input.companyId, input.projectId, input.actorUserId, plan.sourceFileId, plan.sourceBytes]
    .every((value) => Number.isSafeInteger(value) && value > 0) ||
    !/^[a-f0-9]{64}$/.test(plan.requestDigest) || !/^[a-f0-9]{64}$/.test(plan.sourceSha256) ||
    !/^[a-f0-9]{64}$/.test(plan.profileFingerprint) || plan.idempotencyKey !== plan.requestDigest ||
    !plan.credentialId || !plan.importId || !plan.siteId || !plan.libraryId || !plan.siteUrl ||
    !plan.driveRelativePath || !plan.filename || plan.driveRelativePath.split("/").at(-1) !== plan.filename)
    throw new Error("FOLDER_WIZARD_JOB_INVALID");
  const id = input.jobId ?? randomUUID();
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(id)) throw new Error("FOLDER_WIZARD_JOB_ID_INVALID");
  return {
    id, companyId: input.companyId, projectId: input.projectId, actorUserId: input.actorUserId,
    credentialId: plan.credentialId, provider: "sharepoint", jobType: "publish",
    idempotencyKey: plan.idempotencyKey, requestDigest: plan.requestDigest, maxAttempts: 5,
    payload: { kind: "folder_wizard_file_v1", importId: plan.importId,
      profileFingerprint: plan.profileFingerprint, sourceFileId: plan.sourceFileId,
      sourceSha256: plan.sourceSha256, sourceBytes: plan.sourceBytes, siteId: plan.siteId,
      libraryId: plan.libraryId, siteUrl: plan.siteUrl, driveRelativePath: plan.driveRelativePath,
      filename: plan.filename },
  };
}
