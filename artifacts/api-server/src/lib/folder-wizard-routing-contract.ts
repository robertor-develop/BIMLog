import { createHash } from "node:crypto";
import { z } from "zod/v4";
import type { FolderWizardExport } from "./folder-wizard-export";

const token = z.string().trim().min(1).max(160);
const tagKey = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/);

export const folderWizardRoutingProfileSchema = z.object({
  selectors: z.array(z.object({ tagKey, tagValue: token, blueprintName: token }).strict()).max(256),
  tierMappings: z.array(z.object({
    blueprintName: token, tierLabel: token, tagKey,
    values: z.array(z.object({ tagValue: token, item: token }).strict()).min(1).max(256),
  }).strict()).max(128),
}).strict();

export type FolderWizardRoutingProfile = z.infer<typeof folderWizardRoutingProfileSchema>;

/** Reject any rule that cannot be resolved against the exact imported Wizard vocabulary. */
export function validateFolderWizardRoutingProfile(raw: unknown, document: FolderWizardExport): {
  definition: FolderWizardRoutingProfile; fingerprint: string;
} {
  const definition = folderWizardRoutingProfileSchema.parse(raw);
  const blueprints = new Map(document.blueprints.filter((blueprint) => blueprint.include).map((blueprint) => [blueprint.name, blueprint]));
  const selectorKeys = new Set<string>();
  for (const selector of definition.selectors) {
    if (!blueprints.has(selector.blueprintName)) throw new Error("FOLDER_WIZARD_UNKNOWN_BLUEPRINT");
    const key = `${selector.tagKey}\u0000${selector.tagValue.toLocaleLowerCase("en")}`;
    if (selectorKeys.has(key)) throw new Error("FOLDER_WIZARD_DUPLICATE_SELECTOR");
    selectorKeys.add(key);
  }
  if (blueprints.size > 1 && [...blueprints.keys()].some((name) => !definition.selectors.some((selector) => selector.blueprintName === name))) {
    throw new Error("FOLDER_WIZARD_BLUEPRINT_SELECTOR_MISSING");
  }
  const mappedTiers = new Set<string>();
  for (const mapping of definition.tierMappings) {
    const blueprint = blueprints.get(mapping.blueprintName);
    const tier = blueprint?.tiers.find((candidate) => candidate.label === mapping.tierLabel);
    if (!tier) throw new Error("FOLDER_WIZARD_UNKNOWN_TIER");
    const key = `${mapping.blueprintName}\u0000${mapping.tierLabel}`;
    if (mappedTiers.has(key)) throw new Error("FOLDER_WIZARD_DUPLICATE_TIER_MAPPING");
    mappedTiers.add(key);
    const seenValues = new Set<string>();
    for (const value of mapping.values) {
      if (!tier.items.includes(value.item)) throw new Error("FOLDER_WIZARD_UNKNOWN_ITEM");
      const tagValue = value.tagValue.toLocaleLowerCase("en");
      if (seenValues.has(tagValue)) throw new Error("FOLDER_WIZARD_DUPLICATE_TAG_VALUE");
      seenValues.add(tagValue);
    }
  }
  for (const blueprint of blueprints.values()) {
    for (const tier of blueprint.tiers) {
      if (tier.items.length > 1 && !mappedTiers.has(`${blueprint.name}\u0000${tier.label}`)) {
        throw new Error("FOLDER_WIZARD_TIER_MAPPING_MISSING");
      }
    }
  }
  return { definition, fingerprint: createHash("sha256").update(JSON.stringify(definition)).digest("hex") };
}
