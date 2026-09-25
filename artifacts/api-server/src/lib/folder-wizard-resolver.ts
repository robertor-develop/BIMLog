import type { FolderWizardExport } from "./folder-wizard-export";
import { folderWizardDisplayName } from "./folder-wizard-paths";
import type { FolderWizardRoutingProfile } from "./folder-wizard-routing-contract";
import { validateFolderWizardRoutingProfile } from "./folder-wizard-routing-contract";

export class FolderWizardResolutionError extends Error {
  constructor(readonly code: string) { super(code); }
}

export function resolveFolderWizardDestination(input: {
  document: FolderWizardExport;
  profile: FolderWizardRoutingProfile;
  tags: Record<string, string>;
  filename: string;
}): { siteUrl: string; relativeFolderPath: string; relativeFilePath: string; blueprintName: string; profileFingerprint: string } {
  const { document, profile, tags, filename } = input;
  const { fingerprint } = validateFolderWizardRoutingProfile(profile, document);
  if (!document.destination.sharepoint_url) throw new FolderWizardResolutionError("FOLDER_WIZARD_SITE_MISSING");
  if (!filename || filename !== filename.trim() || filename === "." || filename === ".." ||
      /[<>:"/\\|?*\x00-\x1f]/.test(filename) || /[. ]$/.test(filename) || filename.length > 255) {
    throw new FolderWizardResolutionError("FOLDER_WIZARD_FILENAME_INVALID");
  }
  const blueprints = document.blueprints.filter((blueprint) => blueprint.include);
  const matches = profile.selectors.filter((selector) => tags[selector.tagKey] === selector.tagValue);
  const selected = blueprints.length === 1 && matches.length === 0
    ? blueprints[0]
    : matches.length === 1 ? blueprints.find((blueprint) => blueprint.name === matches[0].blueprintName) : undefined;
  if (!selected) throw new FolderWizardResolutionError(matches.length > 1 ? "FOLDER_WIZARD_BLUEPRINT_AMBIGUOUS" : "FOLDER_WIZARD_BLUEPRINT_UNMAPPED");
  const segments = selected.tiers.map((tier) => {
    const mapping = profile.tierMappings.find((candidate) => candidate.blueprintName === selected.name && candidate.tierLabel === tier.label);
    let item: string;
    if (!mapping && tier.items.length === 1) item = tier.items[0];
    else {
      const tagValue = mapping && tags[mapping.tagKey];
      const matched = mapping?.values.find((candidate) => candidate.tagValue === tagValue);
      if (!matched) throw new FolderWizardResolutionError("FOLDER_WIZARD_TIER_UNMAPPED");
      item = matched.item;
    }
    const index = tier.items.indexOf(item);
    if (index < 0) throw new FolderWizardResolutionError("FOLDER_WIZARD_ITEM_STALE");
    return folderWizardDisplayName(tier, index);
  });
  const relativeFolderPath = [document.destination.base_path, ...segments].filter(Boolean).join("/");
  return { siteUrl: document.destination.sharepoint_url, relativeFolderPath,
    relativeFilePath: `${relativeFolderPath}/${filename}`, blueprintName: selected.name, profileFingerprint: fingerprint };
}
