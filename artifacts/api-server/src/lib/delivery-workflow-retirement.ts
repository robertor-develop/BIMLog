export function boundedWorkflowRetirementReason(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const reason = value.trim();
  return reason.length >= 5 && reason.length <= 500 && !/[\u0000-\u001f\u007f]/.test(reason) ? reason : null;
}
