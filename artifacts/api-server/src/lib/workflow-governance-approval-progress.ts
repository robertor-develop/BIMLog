import type { WorkflowGovernancePolicy } from "./workflow-governance-policy-contract";

export type PolicyApprovalStage = { action: string; role: string; level: number };
type Event = { action: string; phaseId: string | null; evidence: Record<string, any> };

/** One ordered chain for phase completion, followed by final-deliverable approval. */
export function workflowPolicyApprovalProgress(policy: WorkflowGovernancePolicy, fingerprint: string,
  phaseId: string, finalPhase: boolean, events: readonly Event[]) {
  const stages: PolicyApprovalStage[] = policy.approvalRules
    .filter(rule => rule.action === "complete_phase" || (finalPhase && rule.action === "complete_deliverable"))
    .sort((a, b) => Number(a.action === "complete_deliverable") - Number(b.action === "complete_deliverable"))
    .flatMap(rule => rule.roles.map((role, level) => ({ action: rule.action, role, level: level + 1 })));
  const resetActions = new Set(["step_reopened", "evidence_linked", "role_assigned", "phase_reopened"]);
  const resetRevision = Math.max(0, ...events.filter(event => resetActions.has(event.action) &&
    (event.phaseId === phaseId || event.action === "role_assigned" ||
      (event.action === "phase_reopened" && event.evidence.resetPhases?.includes(phaseId))))
    .map(event => Number(event.evidence.runtimeRevision) || 0));
  const approvals = events.filter(event => event.action === "policy_stage_approved" && event.phaseId === phaseId &&
    event.evidence.policyFingerprint === fingerprint && Number(event.evidence.runtimeRevision) > resetRevision)
    .sort((a, b) => Number(a.evidence.runtimeRevision) - Number(b.evidence.runtimeRevision));
  let approved = 0;
  for (const event of approvals) {
    const expected = stages[approved];
    if (expected && event.evidence.action === expected.action && event.evidence.role === expected.role &&
      event.evidence.level === expected.level) approved++;
  }
  return { stages, approved, next: stages[approved] ?? null, complete: approved === stages.length };
}
