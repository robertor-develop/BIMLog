import type { LaunchPaymentMethod } from "./launch-payment-provider";

export type LaunchPaymentVerification = Readonly<{
  method: LaunchPaymentMethod;
  mode: "manual" | "sandbox" | "production";
  status: "configured" | "verified" | "failed" | "unavailable";
  code: "manual_configuration_verified" | "provider_connection_verified" | "configuration_invalid" | "provider_unavailable";
}>;
export type LaunchStripeVerificationAdapter = (input: Readonly<{ mode: "sandbox" | "production"; accountReference: string; secretKey: string; webhookSecret: string }>) => Promise<LaunchPaymentVerification>;

export async function verifyLaunchPaymentMethod(input: {
  method: LaunchPaymentMethod;
  mode?: "sandbox" | "production";
  configurationReady: boolean;
  accountReference?: string;
  secretKey?: string;
  webhookSecret?: string;
  stripeAdapter?: LaunchStripeVerificationAdapter;
}): Promise<LaunchPaymentVerification> {
  if (!input.configurationReady) return Object.freeze({ method: input.method, mode: input.method === "stripe" ? input.mode ?? "sandbox" : "manual", status: "failed", code: "configuration_invalid" });
  if (input.method !== "stripe") return Object.freeze({ method: input.method, mode: "manual", status: "configured", code: "manual_configuration_verified" });
  const mode = input.mode ?? "sandbox", accountReference = input.accountReference?.trim() ?? "", secretKey = input.secretKey ?? "", webhookSecret = input.webhookSecret ?? "";
  if (!accountReference || secretKey.length < 12 || webhookSecret.length < 12) return Object.freeze({ method: "stripe", mode, status: "failed", code: "configuration_invalid" });
  if (!input.stripeAdapter) return Object.freeze({ method: "stripe", mode, status: "unavailable", code: "provider_unavailable" });
  return input.stripeAdapter({ mode, accountReference, secretKey, webhookSecret });
}
