import type { LaunchActivationPreflight } from "./launch-activation-preflight";

export type LaunchOwnerInputItem = {
  id: "business_identity" | "email_provider" | "email_authorization" | "payment_selection" | "payment_authorization" | "final_activation";
  category: "owner_input" | "external_verification" | "owner_action";
  pending: boolean;
};

export function inspectLaunchOwnerInputChecklist(input: { configured: boolean; active: boolean; preflight: LaunchActivationPreflight | null }) {
  const preflight = input.preflight;
  const items: LaunchOwnerInputItem[] = [
    { id: "business_identity", category: "owner_input", pending: !preflight?.configurationReady },
    { id: "email_provider", category: "owner_input", pending: !input.configured },
    { id: "email_authorization", category: "external_verification", pending: !preflight?.emailReady },
    { id: "payment_selection", category: "owner_input", pending: !input.configured },
    { id: "payment_authorization", category: "external_verification", pending: !preflight?.paymentsReady },
    { id: "final_activation", category: "owner_action", pending: !input.active },
  ];
  const pending = items.filter(item => item.pending);
  return {
    classification: pending.length ? "LAUNCH_CONFIGURATION_PENDING" as const : "FINAL_ACTIVATION_VERIFIED" as const,
    productCodeBlocked: false,
    pendingCount: pending.length,
    items,
  };
}
