import { parseFolderWizardExport } from "./folder-wizard-export";
import { validateFolderWizardRoutingProfile } from "./folder-wizard-routing-contract";

export type FolderWizardPublishReadinessCode =
  | "IMPORT_MISSING"
  | "SITE_MISSING"
  | "ROUTING_MISSING"
  | "ROUTING_STALE"
  | "ROUTING_INVALID"
  | "PROJECT_MAPPING_MISSING"
  | "PROJECT_MAPPING_DISABLED"
  | "CREDENTIAL_INACTIVE"
  | "SITE_IDENTITY_UNVERIFIED"
  | "LIBRARY_IDENTITY_UNVERIFIED";

export interface FolderWizardPublishReadinessInput {
  sourceText: string | null;
  importId: string | null;
  profile: { definition: unknown; importId: string | null; scope: "company" | "project" } | null;
  projectMapping: { state: string; credentialState: string; siteId: string; libraryId: string } | null;
  verifiedSiteUrl: string | null;
  verifiedLibraryId: string | null;
}

function canonicalSiteUrl(raw: string): string | null {
  if (!URL.canParse(raw)) return null;
  const url = new URL(raw);
  if (url.protocol !== "https:" || !/\.sharepoint\.(com|us)$/i.test(url.hostname) ||
      url.username || url.password || url.search || url.hash || url.pathname === "/") return null;
  return `${url.origin.toLowerCase()}${url.pathname.replace(/\/$/, "").toLowerCase()}`;
}

/** A green routing preview is not proof that a provider destination is authorized. */
export function evaluateFolderWizardPublishReadiness(input: FolderWizardPublishReadinessInput): {
  ready: boolean; blockers: FolderWizardPublishReadinessCode[];
} {
  const blockers: FolderWizardPublishReadinessCode[] = [];
  if (!input.sourceText || !input.importId) return { ready: false, blockers: ["IMPORT_MISSING"] };
  const { document } = parseFolderWizardExport(input.sourceText);
  if (!document.destination.sharepoint_url) blockers.push("SITE_MISSING");
  if (!input.profile) blockers.push("ROUTING_MISSING");
  else {
    if (input.profile.scope === "project" && input.profile.importId !== input.importId) blockers.push("ROUTING_STALE");
    try { validateFolderWizardRoutingProfile(input.profile.definition, document); }
    catch { blockers.push("ROUTING_INVALID"); }
  }
  if (!input.projectMapping) blockers.push("PROJECT_MAPPING_MISSING");
  else {
    if (input.projectMapping.state !== "active") blockers.push("PROJECT_MAPPING_DISABLED");
    if (input.projectMapping.credentialState !== "active") blockers.push("CREDENTIAL_INACTIVE");
    const expectedSite = canonicalSiteUrl(document.destination.sharepoint_url);
    const verifiedSite = input.verifiedSiteUrl && canonicalSiteUrl(input.verifiedSiteUrl);
    if (!expectedSite || !verifiedSite || expectedSite !== verifiedSite) blockers.push("SITE_IDENTITY_UNVERIFIED");
    if (!input.verifiedLibraryId || input.projectMapping.libraryId !== input.verifiedLibraryId) blockers.push("LIBRARY_IDENTITY_UNVERIFIED");
  }
  return { ready: blockers.length === 0, blockers };
}
