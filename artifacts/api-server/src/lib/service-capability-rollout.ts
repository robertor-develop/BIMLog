import type { EntitlementDecision } from "./entitlement-contract";

export type ServiceCapabilityPreset = {
  key: string;
  required: readonly string[];
  optional: readonly string[];
};

export const SERVICE_CAPABILITY_PRESETS: readonly ServiceCapabilityPreset[] = [
  {
    key: "coordination-core",
    required: ["rfi.core"],
    optional: ["navisworks.lens"],
  },
  {
    key: "coordination-with-lens",
    required: ["rfi.core", "navisworks.lens"],
    optional: [],
  },
];

export type CapabilityRolloutState = {
  featureKey: string;
  required: boolean;
  active: boolean;
  reason: "allowed" | "not_selected" | "denied" | "missing_authority";
};

/**
 * Projects a preset over server-produced entitlement decisions. It never grants
 * capability access and therefore cannot turn a missing or denied Lens grant
 * into an active integration.
 */
export function resolveServiceCapabilityRollout(input: {
  presetKey: string;
  selectedOptional?: readonly string[];
  decisions: Readonly<Record<string, EntitlementDecision | undefined>>;
  currentAuthorities: readonly string[];
}): CapabilityRolloutState[] {
  const preset = SERVICE_CAPABILITY_PRESETS.find((row) => row.key === input.presetKey);
  if (!preset) throw new Error("SERVICE_PRESET_UNKNOWN");
  const selected = new Set(input.selectedOptional ?? []);
  const required = new Set(preset.required);
  const keys = [...new Set([...preset.required, ...preset.optional])];

  return keys.map((featureKey) => {
    const isRequired = required.has(featureKey);
    if (!isRequired && !selected.has(featureKey))
      return { featureKey, required: false, active: false, reason: "not_selected" };
    const decision = input.decisions[featureKey];
    if (!decision || decision.decision !== "allow")
      return { featureKey, required: isRequired, active: false, reason: "denied" };
    const authoritySources = decision.sources
      .filter((source) => source.authority === "project_membership")
      .map((source) => source.id);
    if (authoritySources.length > 0 && !authoritySources.some((id) => input.currentAuthorities.includes(id)))
      return { featureKey, required: isRequired, active: false, reason: "missing_authority" };
    return { featureKey, required: isRequired, active: true, reason: "allowed" };
  });
}
