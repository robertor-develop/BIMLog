export const launchPaymentMethods = ["bank_transfer", "qr_payment", "stripe"] as const;
export type LaunchPaymentMethod = (typeof launchPaymentMethods)[number];
export const launchPaymentConfigurationStates = ["NOT_CONFIGURED", "DRAFT", "SANDBOX_CONFIGURED", "SANDBOX_VERIFIED", "PRODUCTION_CONFIGURED", "PRODUCTION_VERIFIED", "FAILED", "DISABLED"] as const;
export type LaunchPaymentConfigurationState = (typeof launchPaymentConfigurationStates)[number];
export type LaunchPaymentCapability = Readonly<{
  method: LaunchPaymentMethod;
  implementation: "SUPPORTED_AND_IMPLEMENTED";
  enabled: boolean;
  mode: "manual" | "sandbox" | "production";
  state: LaunchPaymentConfigurationState;
  issues: readonly string[];
}>;

const unique = <T>(items: readonly T[]) => [...new Set(items)];
export function inspectLaunchPaymentSelection(input: {
  enabledMethods?: readonly string[];
  stripeMode?: "sandbox" | "production";
  bankReady: boolean;
  qrReady: boolean;
  stripeConfigured: boolean;
  stripeVerified?: boolean;
}) {
  const enabledMethods = unique(input.enabledMethods ?? []);
  const unsupported = enabledMethods.filter((method) => !(launchPaymentMethods as readonly string[]).includes(method));
  const enabled = (method: LaunchPaymentMethod) => enabledMethods.includes(method);
  const capability = (method: LaunchPaymentMethod): LaunchPaymentCapability => {
    const isEnabled = enabled(method);
    if (!isEnabled) return Object.freeze({ method, implementation: "SUPPORTED_AND_IMPLEMENTED", enabled: false, mode: method === "stripe" ? input.stripeMode ?? "sandbox" : "manual", state: "DISABLED", issues: Object.freeze([]) });
    const ready = method === "bank_transfer" ? input.bankReady : method === "qr_payment" ? input.qrReady : input.stripeConfigured;
    const verified = method !== "stripe" || input.stripeVerified === true;
    const mode = method === "stripe" ? input.stripeMode ?? "sandbox" : "manual";
    const state: LaunchPaymentConfigurationState = !ready ? "DRAFT" : method !== "stripe" ? "PRODUCTION_CONFIGURED" : verified ? (mode === "production" ? "PRODUCTION_VERIFIED" : "SANDBOX_VERIFIED") : (mode === "production" ? "PRODUCTION_CONFIGURED" : "SANDBOX_CONFIGURED");
    return Object.freeze({ method, implementation: "SUPPORTED_AND_IMPLEMENTED", enabled: true, mode, state, issues: Object.freeze(ready ? [] : [`${method}_configuration_required`]) });
  };
  const capabilities = Object.freeze(launchPaymentMethods.map(capability));
  const issues = Object.freeze([...(enabledMethods.length === 0 ? ["payment_method_required"] : []), ...unsupported.map((method) => `payment_method_unsupported:${method}`), ...capabilities.flatMap((item) => item.issues)]);
  return Object.freeze({ enabledMethods: Object.freeze(enabledMethods.filter((method): method is LaunchPaymentMethod => (launchPaymentMethods as readonly string[]).includes(method))), capabilities, issues, ready: issues.length === 0 });
}
