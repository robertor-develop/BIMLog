import { FolderWizardPublishLeaseStore } from "./folder-wizard-publish-lease";
import { FolderWizardPublishSettlement } from "./folder-wizard-publish-settlement";
import { FolderWizardPublishWorker } from "./folder-wizard-publish-worker";
import { createFolderWizardPublishCandidateStore } from "./folder-wizard-publish-candidate-store";
import { createRuntimeFolderWizardGraphUpload } from "./folder-wizard-graph-upload";
import { storage } from "./storage-adapter";
import { FolderWizardPublishStatusStore } from "./folder-wizard-publish-status";

/** Request-bound execution claims only the confirmed job; it never drains another project's queue. */
export async function executeConfirmedFolderWizardPublish(jobId: string, scope: { projectId: number; actorUserId: number }) {
  const { pool } = await import("@workspace/db");
  const leaseStore = new FolderWizardPublishLeaseStore(pool as never);
  const lease = await leaseStore.claim(`folder-wizard-api-${process.pid}`, jobId);
  if (!lease) return { execution: await new FolderWizardPublishStatusStore(pool as never).executionState(scope, jobId) };
  const worker = new FolderWizardPublishWorker(
    createFolderWizardPublishCandidateStore(undefined, undefined, true), storage,
    createRuntimeFolderWizardGraphUpload(), new FolderWizardPublishSettlement(pool as never));
  return { execution: await worker.run(lease) };
}
