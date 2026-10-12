import type { LaunchPaymentMethod } from "./launch-payment-provider";

export function paymentActivationBlockers(input: {
  selectedMethods: readonly LaunchPaymentMethod[];
  configurationRevision: number;
  evidence: readonly Readonly<{ method: LaunchPaymentMethod; mode: "manual" | "sandbox" | "production"; status: string; revision: number }>[];
  production: boolean;
}) {
  return Object.freeze(input.selectedMethods.flatMap((method) => {
    const item = input.evidence.find((entry) => entry.method === method && entry.revision === input.configurationRevision);
    if (!item) return [`${method}_verification_missing`];
    if (method !== "stripe") return item.status === "configured" ? [] : [`${method}_configuration_unverified`];
    if (item.status !== "verified") return ["stripe_connection_unverified"];
    if (input.production && item.mode !== "production") return ["stripe_production_verification_missing"];
    return [];
  }));
}
