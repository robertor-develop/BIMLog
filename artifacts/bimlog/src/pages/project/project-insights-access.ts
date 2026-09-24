export type ConfirmedProjectRead = {
  projectId: number;
  userId: number;
  reason: string;
};

const REASON_PATTERN = /^[\p{L}\p{N} _.,:/()&+\-'#]{12,120}$/u;

export function validProjectReadReason(reason: string): boolean {
  return REASON_PATTERN.test(reason.trim());
}

export function projectInsightsAccessHeaders(
  access: ConfirmedProjectRead | null,
  projectId: number,
  userId: number | undefined,
): Record<string, string> {
  if (!access || access.projectId !== projectId || access.userId !== userId || !validProjectReadReason(access.reason)) {
    return {};
  }
  return {
    "x-bimlog-super-admin-access": "project-read",
    "x-bimlog-super-admin-reason": access.reason.trim(),
  };
}
