import type { FolderWizardExport } from "./folder-wizard-export";

type Tier = FolderWizardExport["blueprints"][number]["tiers"][number];

/** Mirrors BT Folder Wizard 3.1: 0=AA for width 2, 26=BA. */
function alphaPrefix(value: number, width: number): string {
  let remaining = value;
  let result = "";
  for (let i = 0; i < Math.max(width, 1); i++) {
    result = String.fromCharCode(65 + remaining % 26) + result;
    remaining = Math.floor(remaining / 26);
  }
  while (remaining > 0) {
    result = String.fromCharCode(65 + remaining % 26) + result;
    remaining = Math.floor(remaining / 26);
  }
  return result;
}

export function folderWizardDisplayName(tier: Tier, index: number): string {
  const raw = tier.items[index];
  if (raw === undefined) throw new RangeError("Folder Wizard tier index is out of range");
  if (tier.mode === "none") return raw;
  const value = tier.start + index;
  const prefix = tier.mode === "numeric"
    ? String(value).padStart(tier.width, "0")
    : tier.case === "lower"
      ? alphaPrefix(value, tier.width || 2).toLowerCase()
      : alphaPrefix(value, tier.width || 2);
  return `${prefix}${tier.sep}${raw}`;
}

/** Produces deterministic leaf paths, capped for an untrusted import preview. */
export function previewFolderWizardPaths(document: FolderWizardExport, limit = 100): {
  paths: string[]; totalLeafPaths: string; truncated: boolean;
} {
  if (!Number.isInteger(limit) || limit < 0 || limit > 1_000) throw new RangeError("Invalid preview limit");
  const paths: string[] = [];
  let total = 0n;
  const base = document.destination.base_path ? document.destination.base_path.split("/") : [];
  for (const blueprint of document.blueprints.filter((candidate) => candidate.include)) {
    total += blueprint.tiers.reduce((count, tier) => count * BigInt(tier.items.length), 1n);
    const visit = (tierIndex: number, segments: string[]): void => {
      if (paths.length >= limit) return;
      if (tierIndex === blueprint.tiers.length) {
        paths.push([...base, ...segments].join("/"));
        return;
      }
      const tier = blueprint.tiers[tierIndex];
      for (let index = 0; index < tier.items.length && paths.length < limit; index++) {
        visit(tierIndex + 1, [...segments, folderWizardDisplayName(tier, index)]);
      }
    };
    visit(0, []);
  }
  return { paths, totalLeafPaths: total.toString(), truncated: total > BigInt(paths.length) };
}
