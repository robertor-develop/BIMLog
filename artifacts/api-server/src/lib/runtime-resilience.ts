export type RecoveryDecision = "retry" | "resume" | "fail_closed";

export function recoveryDecision(input: {
  operation: "read" | "idempotent_write" | "non_idempotent_write";
  failure: "provider_unavailable" | "database_disconnect" | "partial_response" | "invalid_session";
  acknowledged: boolean;
}): RecoveryDecision {
  if (input.failure === "invalid_session") return "fail_closed";
  if (input.operation === "non_idempotent_write") return "fail_closed";
  if (input.acknowledged) return "resume";
  return "retry";
}

export function boundedRetryDelay(attempt: number, baseMs = 100, maximumMs = 5_000): number {
  if (!Number.isInteger(attempt) || attempt < 0) throw new Error("RETRY_ATTEMPT_INVALID");
  return Math.min(maximumMs, baseMs * 2 ** attempt);
}
