export type PublicationRecoveryPoint = { sourceCommit: string; jobCount: number; eventCount: number; digest: string; loginVerified: boolean };
export function verifyPublicationRecoveryPoint(before: PublicationRecoveryPoint, restored: PublicationRecoveryPoint): boolean {
  return /^[0-9a-f]{40}$/.test(before.sourceCommit) && /^[0-9a-f]{64}$/.test(before.digest) && before.sourceCommit === restored.sourceCommit && before.jobCount === restored.jobCount && before.eventCount === restored.eventCount && before.digest === restored.digest && restored.loginVerified;
}
