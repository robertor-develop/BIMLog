export type DashboardGuidanceState = "loading" | "ready" | "empty" | "unavailable";

export function dashboardGuidanceState(input: {
  enabled: boolean;
  loading: boolean;
  failed: boolean;
  candidateCount: number;
}): DashboardGuidanceState {
  if (!input.enabled || input.loading) return "loading";
  if (input.failed) return "unavailable";
  return input.candidateCount > 0 ? "ready" : "empty";
}
