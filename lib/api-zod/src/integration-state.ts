export const INTEGRATION_STATES = [
  "unavailable", "setup_required", "connecting", "connected", "routing_ready",
  "import_ready", "failed", "revoked", "reauthorized",
] as const;
export type IntegrationState = typeof INTEGRATION_STATES[number];

export function integrationCapabilities(state: IntegrationState) {
  return {
    configured: !["unavailable", "setup_required", "revoked"].includes(state),
    canRoute: state === "routing_ready" || state === "reauthorized",
    canImport: state === "import_ready" || state === "reauthorized",
    needsAttention: ["setup_required", "failed", "revoked"].includes(state),
  };
}
