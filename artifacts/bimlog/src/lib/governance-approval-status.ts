type Progress = { approved: number; stages: Array<{ role: string; level: number; action: string }>; next: null | { role: string; level: number; action: string }; complete: boolean };
export function governanceApprovalStatus(progress: Progress | null, policyCode: string | null, spanish: boolean) {
  if (!progress) return null;
  if (progress.complete) return spanish ? "Las aprobaciones exigidas por la política están completas." : "The approvals required by the policy are complete.";
  const next = progress.next;
  if (!next) return null;
  const policy = policyCode || (spanish ? "la política publicada" : "the published policy");
  return spanish
    ? `${policy} exige ahora ${next.role} para ${next.action}; etapa ${next.level}. Este requisito proviene de la política publicada.`
    : `${policy} now requires ${next.role} for ${next.action}; stage ${next.level}. This requirement comes from the published policy.`;
}
