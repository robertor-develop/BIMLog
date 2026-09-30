export type ReleaseHandoff = Readonly<{
  sourceCommit: string;
  deploymentId: string;
  completedGates: readonly string[];
  knownLimits: readonly Readonly<{ id: string; disposition: "accepted" | "deferred"; reason: string }>[];
  releaseScope: readonly string[];
  rollbackSourceCommit: string;
  rollbackRehearsed: boolean;
  unresolvedPriorities: readonly ("P0" | "P1" | "P2" | "P3")[];
}>;

const SHA = /^[0-9a-f]{40}$/;
export function verifyReleaseHandoff(handoff: ReleaseHandoff) {
  const failures: string[] = [];
  if (!SHA.test(handoff.sourceCommit)) failures.push("SOURCE_COMMIT_INVALID");
  if (!SHA.test(handoff.rollbackSourceCommit) || handoff.rollbackSourceCommit === handoff.sourceCommit) failures.push("ROLLBACK_SOURCE_INVALID");
  if (!handoff.deploymentId.trim()) failures.push("DEPLOYMENT_ID_REQUIRED");
  if (!handoff.completedGates.length || !handoff.releaseScope.length) failures.push("RELEASE_EVIDENCE_INCOMPLETE");
  if (!handoff.rollbackRehearsed) failures.push("ROLLBACK_NOT_REHEARSED");
  if (handoff.unresolvedPriorities.some((priority) => priority === "P0" || priority === "P1")) failures.push("UNRESOLVED_HIGH_PRIORITY_DEFECT");
  for (const limit of handoff.knownLimits) if (!limit.id.trim() || !limit.reason.trim()) failures.push("KNOWN_LIMIT_INCOMPLETE");
  return Object.freeze({ status: failures.length ? "blocked" : "ready", failures: Object.freeze(failures) });
}
