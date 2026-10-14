export type LaunchActivationPreflight = Readonly<{
  environment: "development" | "staging" | "production";
  configurationRevision: number;
  configurationReady: boolean;
  emailReady: boolean;
  paymentsReady: boolean;
  activationReady: boolean;
  classification: "LAUNCH_CONFIGURATION_PENDING" | "GA_CANDIDATE" | "FINAL_ACTIVATION_VERIFIED";
  blockers: readonly string[];
}>;

const environments = new Set(["development", "staging", "production"]);
const classifications = new Set(["LAUNCH_CONFIGURATION_PENDING", "GA_CANDIDATE", "FINAL_ACTIVATION_VERIFIED"]);

export function parseLaunchActivationPreflight(value: unknown): LaunchActivationPreflight | null {
  if (value === null) return null;
  if (!value || typeof value !== "object") throw new Error("LAUNCH_ACTIVATION_PREFLIGHT_INVALID");
  const item = value as Record<string, unknown>;
  if (!environments.has(String(item.environment)) || !Number.isSafeInteger(item.configurationRevision) || Number(item.configurationRevision) < 1 || !classifications.has(String(item.classification))) throw new Error("LAUNCH_ACTIVATION_PREFLIGHT_INVALID");
  for (const field of ["configurationReady", "emailReady", "paymentsReady", "activationReady"] as const) if (typeof item[field] !== "boolean") throw new Error("LAUNCH_ACTIVATION_PREFLIGHT_INVALID");
  if (!Array.isArray(item.blockers) || item.blockers.some((blocker) => typeof blocker !== "string" || !/^[a-z0-9_]+$/.test(blocker))) throw new Error("LAUNCH_ACTIVATION_PREFLIGHT_INVALID");
  if (item.activationReady !== (item.configurationReady && item.emailReady && item.paymentsReady)) throw new Error("LAUNCH_ACTIVATION_PREFLIGHT_CONTRADICTORY");
  if (item.classification === "LAUNCH_CONFIGURATION_PENDING" && item.activationReady) throw new Error("LAUNCH_ACTIVATION_PREFLIGHT_CONTRADICTORY");
  if (item.classification !== "LAUNCH_CONFIGURATION_PENDING" && !item.activationReady) throw new Error("LAUNCH_ACTIVATION_PREFLIGHT_CONTRADICTORY");
  return Object.freeze({
    environment: item.environment as LaunchActivationPreflight["environment"],
    configurationRevision: Number(item.configurationRevision),
    configurationReady: item.configurationReady,
    emailReady: item.emailReady,
    paymentsReady: item.paymentsReady,
    activationReady: item.activationReady,
    classification: item.classification as LaunchActivationPreflight["classification"],
    blockers: Object.freeze([...item.blockers] as string[]),
  });
}
