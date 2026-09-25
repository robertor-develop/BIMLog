import { z } from "zod/v4";
import { parseFolderWizardExport } from "./folder-wizard-export";
import { evaluateFolderWizardPublishReadiness } from "./folder-wizard-publish-readiness";
import { folderWizardRoutingProfileSchema } from "./folder-wizard-routing-contract";
import { planFolderWizardPublish } from "./folder-wizard-publish-plan";
import { readVerifiedPublishSource } from "./folder-wizard-publish-source";
import type { FolderWizardCandidateReader } from "./folder-wizard-publish-candidate";
import type { FolderWizardLease } from "./folder-wizard-publish-lease";
import type { FolderWizardPublishSettlement, PublishOutcome } from "./folder-wizard-publish-settlement";
import type { StorageAdapter } from "./storage-adapter";

const digest = z.string().regex(/^[a-f0-9]{64}$/);
const payloadSchema = z.object({ kind: z.literal("folder_wizard_file_v1"),
  importId: z.string().min(1), profileFingerprint: digest,
  tags: z.record(z.string().regex(/^[a-z][a-z0-9_]{0,63}$/), z.string().max(160)),
  sourceFileId: z.number().int().positive(), sourceSha256: digest,
  sourceBytes: z.number().int().positive().max(10 * 1024 * 1024),
  siteId: z.string().min(1), libraryId: z.string().min(1), siteUrl: z.string().url(),
  driveRelativePath: z.string().min(1), filename: z.string().min(1),
}).strict();
type Uploader = { create(input: { companyId: number; credentialId: string; driveId: string;
  driveRelativePath: string; filename: string; bytes: Buffer }): Promise<{ itemId: string }> };
type Settlement = Pick<FolderWizardPublishSettlement, "settle">;

/** Deliberately not scheduled or mounted: provider writes need round-trip acceptance first. */
export class FolderWizardPublishWorker {
  constructor(private readonly reader: FolderWizardCandidateReader, private readonly storage: StorageAdapter,
    private readonly uploader: Uploader, private readonly settlement: Settlement) {}

  async run(lease: FolderWizardLease): Promise<"completed" | "retry" | "dead_letter"> {
    let bytes: Buffer | null = null;
    let outcome: PublishOutcome;
    try {
      const payload = payloadSchema.parse(lease.payload);
      const snapshot = await this.reader.read(lease.projectId, lease.createdById, payload.sourceFileId);
      const readiness = evaluateFolderWizardPublishReadiness({ sourceText: snapshot.sourceText,
        importId: snapshot.importId, profile: snapshot.profile, projectMapping: snapshot.mapping,
        verifiedSiteUrl: snapshot.verifiedSiteUrl, verifiedLibraryId: snapshot.verifiedLibraryId });
      if (!readiness.ready || !snapshot.file || snapshot.file.projectId !== lease.projectId)
        throw new Error("FOLDER_WIZARD_JOB_SOURCE_STALE");
      bytes = await readVerifiedPublishSource(snapshot.file, this.storage);
      const document = parseFolderWizardExport(snapshot.sourceText!).document;
      const plan = planFolderWizardPublish({ document, importId: snapshot.importId!,
        profile: folderWizardRoutingProfileSchema.parse(snapshot.profile!.definition), tags: payload.tags,
        filename: snapshot.file.name, sourceFileId: snapshot.file.id,
        sourceSha256: snapshot.file.sha256, sourceBytes: bytes.length,
        credentialId: snapshot.mapping!.credentialId, siteId: snapshot.mapping!.siteId,
        libraryId: snapshot.mapping!.libraryId, verifiedSiteUrl: snapshot.verifiedSiteUrl!,
        verifiedLibraryId: snapshot.verifiedLibraryId! });
      if (plan.requestDigest !== lease.requestDigest || plan.credentialId !== lease.credentialId ||
          plan.sourceFileId !== payload.sourceFileId || plan.sourceSha256 !== payload.sourceSha256 ||
          plan.sourceBytes !== payload.sourceBytes || plan.importId !== payload.importId ||
          plan.profileFingerprint !== payload.profileFingerprint || plan.siteId !== payload.siteId ||
          plan.libraryId !== payload.libraryId || plan.siteUrl !== payload.siteUrl ||
          plan.driveRelativePath !== payload.driveRelativePath || plan.filename !== payload.filename)
        throw new Error("FOLDER_WIZARD_JOB_SOURCE_STALE");
      const uploaded = await this.uploader.create({ companyId: lease.companyId,
        credentialId: lease.credentialId, driveId: plan.libraryId,
        driveRelativePath: plan.driveRelativePath, filename: plan.filename, bytes });
      outcome = { kind: "completed", itemId: uploaded.itemId };
    } catch (error) {
      const code = error instanceof Error && /^FOLDER_WIZARD_[A-Z_]{1,80}$/.test(error.message)
        ? error.message : "FOLDER_WIZARD_PUBLISH_FAILED";
      outcome = { kind: "failed", code, retryable: code === "FOLDER_WIZARD_GRAPH_UPLOAD_FAILED" ||
        code === "FOLDER_WIZARD_GRAPH_IDENTITY_UNAVAILABLE" ||
        code === "FOLDER_WIZARD_GRAPH_CONFLICT_UNRESOLVED" };
    } finally { bytes?.fill(0); }
    return this.settlement.settle(lease, outcome);
  }
}
