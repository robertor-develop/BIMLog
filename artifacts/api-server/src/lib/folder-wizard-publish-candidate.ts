import { parseFolderWizardExport } from "./folder-wizard-export";
import { evaluateFolderWizardPublishReadiness } from "./folder-wizard-publish-readiness";
import { planFolderWizardPublish } from "./folder-wizard-publish-plan";
import { readVerifiedPublishSource, type PublishSource } from "./folder-wizard-publish-source";
import type { StorageAdapter } from "./storage-adapter";

export type FolderWizardCandidateSnapshot = {
  importId: string | null; sourceText: string | null;
  profile: { definition: unknown; importId: string | null; scope: "company" | "project" } | null;
  mapping: { state: string; credentialState: string; credentialId: string; siteId: string; libraryId: string } | null;
  verifiedSiteUrl: string | null; verifiedLibraryId: string | null;
  file: PublishSource | null;
};
export type FolderWizardCandidateReader = { read(projectId: number, actorUserId: number, fileId: number): Promise<FolderWizardCandidateSnapshot> };

/** Read-only preview. Every check must be repeated by the eventual write worker. */
export class FolderWizardPublishCandidateService {
  constructor(private readonly reader: FolderWizardCandidateReader, private readonly storage: StorageAdapter) {}

  async preview(input: { projectId: number; actorUserId: number; fileId: number; tags: Record<string, string> }) {
    if (![input.projectId, input.actorUserId, input.fileId].every((value) => Number.isSafeInteger(value) && value > 0) ||
        Object.keys(input.tags).length > 64 || Object.entries(input.tags).some(([key, value]) =>
          !/^[a-z][a-z0-9_]{0,63}$/.test(key) || typeof value !== "string" || value.length > 160))
      throw new Error("FOLDER_WIZARD_CANDIDATE_INVALID");
    const snapshot = await this.reader.read(input.projectId, input.actorUserId, input.fileId);
    const readiness = evaluateFolderWizardPublishReadiness({ sourceText: snapshot.sourceText, importId: snapshot.importId,
      profile: snapshot.profile, projectMapping: snapshot.mapping, verifiedSiteUrl: snapshot.verifiedSiteUrl,
      verifiedLibraryId: snapshot.verifiedLibraryId });
    if (!readiness.ready) return { ready: false as const, blockers: readiness.blockers };
    if (!snapshot.file || snapshot.file.projectId !== input.projectId) throw new Error("FOLDER_WIZARD_SOURCE_FORBIDDEN");
    const bytes = await readVerifiedPublishSource(snapshot.file, this.storage);
    const document = parseFolderWizardExport(snapshot.sourceText!).document;
    const plan = planFolderWizardPublish({ document, importId: snapshot.importId!, profile: snapshot.profile!.definition as never,
      tags: input.tags, filename: snapshot.file.name, sourceFileId: snapshot.file.id,
      sourceSha256: snapshot.file.sha256, sourceBytes: bytes.length, credentialId: snapshot.mapping!.credentialId,
      siteId: snapshot.mapping!.siteId, libraryId: snapshot.mapping!.libraryId,
      verifiedSiteUrl: snapshot.verifiedSiteUrl!, verifiedLibraryId: snapshot.verifiedLibraryId! });
    return { ready: true as const, blockers: [] as string[], fileId: snapshot.file.id,
      filename: snapshot.file.name, byteSize: bytes.length, siteUrl: plan.siteUrl,
      driveRelativePath: plan.driveRelativePath, requestDigest: plan.requestDigest,
      publicationState: "not_submitted" as const };
  }
}
