import { paymentActivationBlockers } from "./launch-payment-activation";
import type { LaunchPaymentMethod } from "./launch-payment-provider";

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

export function inspectLaunchActivationPreflight(input: {
  environment: "development" | "staging" | "production";
  configurationRevision: number;
  configurationEntered: boolean;
  active: boolean;
  emailProvider?: "smtp" | "sendgrid";
  emailEvidence?: Readonly<{ provider: string; status: string }> | null;
  selectedPaymentMethods: readonly LaunchPaymentMethod[];
  paymentEvidence: readonly Readonly<{ method: LaunchPaymentMethod; mode: "manual" | "sandbox" | "production"; status: string; revision: number }>[];
}): LaunchActivationPreflight {
  const emailRequired = input.environment === "production";
  const emailReady = !emailRequired || (!!input.emailEvidence && input.emailEvidence.provider === input.emailProvider && ["verified", "sent"].includes(input.emailEvidence.status));
  const paymentBlockers = paymentActivationBlockers({
    selectedMethods: input.selectedPaymentMethods,
    configurationRevision: input.configurationRevision,
    evidence: input.paymentEvidence,
    production: input.environment === "production",
  });
  const blockers = Object.freeze([
    ...(!input.configurationEntered ? ["launch_configuration_incomplete"] : []),
    ...(!emailReady ? ["transactional_email_verification_missing"] : []),
    ...paymentBlockers,
  ]);
  const activationReady = blockers.length === 0;
  const classification = input.active && activationReady
    ? "FINAL_ACTIVATION_VERIFIED"
    : activationReady ? "GA_CANDIDATE" : "LAUNCH_CONFIGURATION_PENDING";
  return Object.freeze({
    environment: input.environment,
    configurationRevision: input.configurationRevision,
    configurationReady: input.configurationEntered,
    emailReady,
    paymentsReady: paymentBlockers.length === 0,
    activationReady,
    classification,
    blockers,
  });
}
