export const PROVIDER_RECOVERY_STOP_CONDITIONS = Object.freeze([
  "PROMOTION_STATE_AMBIGUOUS",
  "CANDIDATE_IDENTITY_CHANGED",
  "PROVIDER_RETRY_LIMIT_REACHED",
]);

export function advanceProviderAttempt(state, event) {
  if (!state || !event || state.candidate !== event.candidate) return { status: "STOP", code: "CANDIDATE_IDENTITY_CHANGED" };
  if (state.status === "PROMOTED") return { ...state, status: "STOP", code: "PROMOTION_STATE_AMBIGUOUS" };
  if (event.type === "STAGE_PASSED") return { ...state, stage: event.stage, status: event.stage === "PROMOTE" ? "PROMOTED" : "RUNNING" };
  if (event.type !== "INTERRUPTED") return { ...state, status: "STOP", code: "PROVIDER_EVENT_INVALID" };
  if (state.stage === "PROMOTE" || event.promotionObserved === true) return { ...state, status: "STOP", code: "PROMOTION_STATE_AMBIGUOUS" };
  if (state.attempt >= state.maxAttempts) return { ...state, status: "STOP", code: "PROVIDER_RETRY_LIMIT_REACHED" };
  return { ...state, status: "RETRY", attempt: state.attempt + 1, retryToken: `${state.candidate}:${state.attempt + 1}` };
}
