export const launchReadinessStates = [
  "DEVELOPMENT_INCOMPLETE",
  "INTERNAL_TEST_READY",
  "GA_CANDIDATE_CONFIGURATION_READY",
  "LAUNCH_CONFIGURATION_ENTERED",
  "FINAL_ACTIVATION_VERIFIED",
  "GENERAL_AVAILABILITY_APPROVED",
] as const;

export type LaunchReadinessState = (typeof launchReadinessStates)[number];

export type LaunchConfigurationSectionStatus = "not_configured" | "invalid" | "ready" | "active";

export type LaunchConfigurationSection<T> = Readonly<{
  status: LaunchConfigurationSectionStatus;
  value: Readonly<T> | null;
  issues: readonly string[];
}>;

export const ownerReservedLaunchFields = Object.freeze([
  "legalBusinessName",
  "businessIdentificationNumber",
  "businessAddress",
  "billingAddress",
  "supportEmail",
  "transactionalEmailAddress",
  "emailProvider",
  "manualPaymentMethods",
] as const);

export function isLaunchReadinessState(value: string): value is LaunchReadinessState {
  return (launchReadinessStates as readonly string[]).includes(value);
}
