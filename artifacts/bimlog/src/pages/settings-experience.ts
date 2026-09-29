export type SettingsScope = "personal" | "company" | "platform";

export const settingsDestinations = [
  { scope: "personal" as const, label: "Personal settings", href: "/profile", owner: "You", description: "Your identity, security, channel connections and personal choices." },
  { scope: "company" as const, label: "Company settings", href: "/settings/company-profile", owner: "Company administrator", description: "Shared company identity, libraries and governed defaults." },
  { scope: "platform" as const, label: "Platform administration", href: "/admin", owner: "Global administrator", description: "Environment controls and operational administration." },
];

export function effectiveNotificationSummary(input: {
  enabled: boolean; paused: boolean; frequency: string; telegramConnected: boolean;
  telegramEnabled: boolean; emailAvailable: boolean; inAppEnabled?: boolean;
}) {
  const delivery = !input.enabled ? "Off" : input.paused ? "Paused" : input.frequency.replaceAll("_", " ");
  return {
    delivery,
    channels: [
      { key: "in-app", label: "In-app", state: input.inAppEnabled === false ? "Off" : "Available" },
      { key: "telegram", label: "Telegram", state: input.telegramConnected && input.telegramEnabled ? "Ready" : input.telegramConnected ? "Connected, disabled" : "Setup required" },
      { key: "email", label: "Email", state: input.emailAvailable ? "Available" : "Unavailable" },
    ],
  };
}

export type ConnectorReadiness = "ready" | "setup_required" | "permission_required" | "error";
export function connectorReadinessCopy(state: ConnectorReadiness) {
  return {
    ready: { label: "Ready", action: "Use connector", detail: "Connection and required permission are verified." },
    setup_required: { label: "Setup required", action: "Open setup", detail: "An administrator must configure this connector before it can be used." },
    permission_required: { label: "Permission required", action: "Contact administrator", detail: "The connector exists, but your role cannot use or configure it." },
    error: { label: "Needs attention", action: "Retry status", detail: "Readiness could not be verified. No external request was sent." },
  }[state];
}

export function effectiveRoleLabel(role?: string | null) {
  const normalized = String(role ?? "").trim().toLowerCase();
  const labels: Record<string, string> = {
    owner: "Company owner", admin: "Company administrator", project_admin: "Project administrator",
    bim_manager: "BIM manager", coordinator: "BIM coordinator", member: "Project member", viewer: "Viewer",
    super_admin: "Global super administrator",
  };
  return { effective: labels[normalized] ?? "Project member", legacy: normalized && !labels[normalized] ? role! : null };
}

export function librarySelectionState(input: { loading?: boolean; error?: boolean; count: number; canAuthor?: boolean }) {
  if (input.loading) return { state: "loading", title: "Loading published library…", action: null };
  if (input.error) return { state: "error", title: "Library unavailable", action: "Retry" };
  if (input.count > 0) return { state: "ready", title: `${input.count} published option${input.count === 1 ? "" : "s"} available`, action: "Select and preview" };
  return input.canAuthor
    ? { state: "empty-author", title: "No published options yet", action: "Create a governed draft" }
    : { state: "empty-reader", title: "No published options yet", action: "Ask a company administrator to publish one" };
}
