export type EmailReadinessState = "not_configured" | "configured" | "unverified" | "ready" | "error";
export type SafeConnection = { provider: string; status: string; accountLabel?: string | null; lastError?: string | null };

export function resolveEmailReadiness(connection?: SafeConnection | null): EmailReadinessState {
  if (!connection) return "not_configured";
  if (connection.status === "ready" || connection.status === "verified") return "ready";
  if (connection.status === "connected") return "unverified";
  if (connection.status === "error" || connection.lastError) return "error";
  return "configured";
}

export function emailReadinessCopy(state: EmailReadinessState) {
  return {
    not_configured: { label: "Not configured", detail: "Email is optional for setup. Configure it now or continue and send later." },
    configured: { label: "Configured", detail: "Connection details are saved, but sending readiness has not been verified." },
    unverified: { label: "Connected, sender unverified", detail: "The API key is accepted. Verify the sender before relying on direct delivery." },
    ready: { label: "Ready", detail: "The current sender and provider are verified for direct BIMLog delivery." },
    error: { label: "Needs attention", detail: "The provider could not verify this connection. Reconnect it before sending." },
  }[state];
}
