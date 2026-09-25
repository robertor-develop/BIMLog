import { createHash } from "node:crypto";
import type { FolderWizardExport } from "./folder-wizard-export";
import type { FolderWizardRoutingProfile } from "./folder-wizard-routing-contract";
import { resolveFolderWizardDestination } from "./folder-wizard-resolver";

export type FolderWizardPublishPlan = {
  requestDigest: string; idempotencyKey: string; driveRelativePath: string; filename: string;
  sourceFileId: number; sourceSha256: string; sourceBytes: number; importId: string; profileFingerprint: string;
  credentialId: string; siteId: string; libraryId: string; siteUrl: string;
};

function canonicalSite(raw: string): string {
  if (!URL.canParse(raw)) throw new Error("FOLDER_WIZARD_SITE_INVALID");
  const url = new URL(raw);
  if (url.protocol !== "https:" || !/\.sharepoint\.(com|us)$/i.test(url.hostname) || url.search || url.hash || url.username || url.password)
    throw new Error("FOLDER_WIZARD_SITE_INVALID");
  return `${url.origin.toLowerCase()}${url.pathname.replace(/\/$/, "").toLowerCase()}`;
}

/** Freeze all authority and exact route inputs before any external side effect. */
export function planFolderWizardPublish(input: {
  document: FolderWizardExport; importId: string; profile: FolderWizardRoutingProfile;
  tags: Record<string, string>; filename: string; sourceFileId: number; sourceSha256: string; sourceBytes: number;
  credentialId: string; siteId: string; libraryId: string; verifiedSiteUrl: string; verifiedLibraryId: string;
}): FolderWizardPublishPlan {
  if (!Number.isSafeInteger(input.sourceFileId) || input.sourceFileId <= 0 ||
      !Number.isSafeInteger(input.sourceBytes) || input.sourceBytes <= 0 || input.sourceBytes > 10 * 1024 * 1024 ||
      !/^[a-f0-9]{64}$/.test(input.sourceSha256) || !input.importId ||
      !input.credentialId || !input.siteId || !input.libraryId || input.libraryId !== input.verifiedLibraryId ||
      canonicalSite(input.document.destination.sharepoint_url) !== canonicalSite(input.verifiedSiteUrl))
    throw new Error("FOLDER_WIZARD_PUBLISH_AUTHORITY_INVALID");
  const resolved = resolveFolderWizardDestination({ document: input.document, profile: input.profile,
    tags: input.tags, filename: input.filename });
  const base = input.document.destination.base_path.replace(/^\/+|\/+$/g, "");
  const relative = resolved.relativeFilePath;
  if (!base || !relative.toLowerCase().startsWith(`${base.toLowerCase()}/`))
    throw new Error("FOLDER_WIZARD_LIBRARY_ROOT_MISMATCH");
  const driveRelativePath = relative.slice(base.length + 1);
  if (!driveRelativePath || driveRelativePath.split("/").some((part) => !part || part === "." || part === ".."))
    throw new Error("FOLDER_WIZARD_LIBRARY_PATH_INVALID");
  const identity = JSON.stringify({ importId: input.importId, sourceFileId: input.sourceFileId,
    sourceSha256: input.sourceSha256, sourceBytes: input.sourceBytes, profileFingerprint: resolved.profileFingerprint,
    credentialId: input.credentialId, siteId: input.siteId, libraryId: input.libraryId,
    siteUrl: canonicalSite(input.verifiedSiteUrl), driveRelativePath });
  const requestDigest = createHash("sha256").update(identity).digest("hex");
  return { requestDigest, idempotencyKey: requestDigest, driveRelativePath, filename: input.filename,
    sourceFileId: input.sourceFileId, sourceSha256: input.sourceSha256, sourceBytes: input.sourceBytes,
    importId: input.importId, profileFingerprint: resolved.profileFingerprint,
    credentialId: input.credentialId, siteId: input.siteId, libraryId: input.libraryId,
    siteUrl: canonicalSite(input.verifiedSiteUrl) };
}
