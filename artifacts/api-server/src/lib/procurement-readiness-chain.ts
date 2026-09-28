export type SubmittalDecision = "not_submitted" | "submitted" | "revise_resubmit" | "approved" | "approved_as_noted" | "rejected";
export type ProcurementState = "not_started" | "quoted" | "ordered" | "shipped" | "delivered";

export interface ProcurementReadinessInput {
  projectId: number;
  requirementId: string;
  packageId: number | null;
  packageRevisionId: string | null;
  decision: SubmittalDecision;
  decisionEvidenceId: string | null;
  materialId: string | null;
  procurementState: ProcurementState;
}

export interface ProcurementReadinessChain extends ProcurementReadinessInput {
  approvalProven: boolean;
  procurementEvidenceState: "not_applicable" | "blocked_unapproved" | "traceable";
  warning: string | null;
}

export function buildProcurementReadinessChain(input: ProcurementReadinessInput): ProcurementReadinessChain {
  if (!Number.isSafeInteger(input.projectId) || input.projectId <= 0 || !input.requirementId.trim()) throw new Error("Project and requirement identity are required.");
  const approvedDecision = input.decision === "approved" || input.decision === "approved_as_noted";
  const approvalProven = approvedDecision && Boolean(input.packageId && input.packageRevisionId?.trim() && input.decisionEvidenceId?.trim());
  const hasProcurementClaim = input.procurementState !== "not_started";
  if (!input.materialId && hasProcurementClaim) throw new Error("A procurement claim requires a material identity.");
  return {
    ...input,
    approvalProven,
    procurementEvidenceState: !hasProcurementClaim ? "not_applicable" : approvalProven ? "traceable" : "blocked_unapproved",
    warning: hasProcurementClaim && !approvalProven
      ? "Procurement activity exists, but approved submittal evidence is not proven."
      : null,
  };
}
