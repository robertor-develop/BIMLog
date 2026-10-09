export type OperationalPulseRefreshState = "current" | "refreshing" | "unavailable";

export function operationalPulseRefreshState(input: {
  isFetching: boolean;
  hasError: boolean;
  hasVerifiedData: boolean;
}): OperationalPulseRefreshState {
  if (input.isFetching) return "refreshing";
  if (input.hasError || !input.hasVerifiedData) return "unavailable";
  return "current";
}

export function formatOperationalPulseCheckedAt(epochMs: number, lang: string): string | null {
  if (!Number.isFinite(epochMs) || epochMs <= 0) return null;
  return new Intl.DateTimeFormat(lang === "es" ? "es" : "en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(epochMs));
}

export function formatOperationalPulseComparisonAt(epochMs: number, lang: string): string | null {
  if (!Number.isFinite(epochMs) || epochMs <= 0) return null;
  return new Intl.DateTimeFormat(lang === "es" ? "es" : "en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(epochMs));
}
