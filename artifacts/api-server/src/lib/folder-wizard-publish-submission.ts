import { FolderWizardImportError, authorizeFolderWizardImport } from "./folder-wizard-import-service";
import { createFolderWizardPublishJob } from "./folder-wizard-publish-job";
import { FolderWizardPublishCandidateService } from "./folder-wizard-publish-candidate";
import { createFolderWizardPublishCandidateStore } from "./folder-wizard-publish-candidate-store";
import { createRuntimeFolderWizardPublishQueue, type FolderWizardPublishQueue } from "./folder-wizard-publish-queue";
import { storage } from "./storage-adapter";

type Scope = { projectId: number; actorUserId: number };
type Input = Scope & { fileId: number; tags: Record<string, string>; expectedDigest: string;
  confirmation: "publish_sharepoint" };
type Prepared = Pick<FolderWizardPublishCandidateService, "prepare">;
type Queue = Pick<FolderWizardPublishQueue, "enqueue">;

/** The confirmation names the exact preview digest; a changed route needs a new preview. */
export class FolderWizardPublishSubmission {
  constructor(private readonly candidate: Prepared, private readonly queue: Queue,
    private readonly authorize: (scope: Scope) => Promise<number>) {}

  async submit(input: Input): Promise<{ jobId: string; result: "queued" | "idempotent" }> {
    if (input.confirmation !== "publish_sharepoint" || !/^[a-f0-9]{64}$/.test(input.expectedDigest))
      throw new FolderWizardImportError("FOLDER_WIZARD_PUBLISH_CONFIRMATION_REQUIRED", 400);
    const companyId = await this.authorize(input);
    const { preview, plan } = await this.candidate.prepare(input);
    if (!preview.ready || !plan) throw new FolderWizardImportError("FOLDER_WIZARD_PUBLISH_NOT_READY", 409);
    if (plan.requestDigest !== input.expectedDigest)
      throw new FolderWizardImportError("FOLDER_WIZARD_PUBLISH_PREVIEW_STALE", 409);
    const job = createFolderWizardPublishJob({ companyId, projectId: input.projectId,
      actorUserId: input.actorUserId, plan });
    return this.queue.enqueue(job);
  }
}

export async function createRuntimeFolderWizardPublishSubmission(): Promise<FolderWizardPublishSubmission> {
  const { pool } = await import("@workspace/db");
  const authorize = async (scope: Scope) => {
    const client = await pool.connect();
    try { return await authorizeFolderWizardImport(client as never, scope, true); }
    finally { client.release(); }
  };
  return new FolderWizardPublishSubmission(
    new FolderWizardPublishCandidateService(createFolderWizardPublishCandidateStore(), storage),
    await createRuntimeFolderWizardPublishQueue(), authorize);
}
