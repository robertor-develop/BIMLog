import crypto from "node:crypto";
import type { ProcurementLeadTimeRisk } from "./procurement-lead-time-risk";
import type { ProcurementReadinessChain } from "./procurement-readiness-chain";

export interface SpecificationProcurementReadinessRow {
  projectId: number;
  requirementId: string;
  requirementCode: string;
  title: string;
  sourceUrl: string;
  packageUrl: string | null;
  chain: ProcurementReadinessChain;
  leadTime: ProcurementLeadTimeRisk;
}

export interface SpecificationProcurementReadinessView {
  projectId: number;
  generatedAt: string;
  rows: SpecificationProcurementReadinessRow[];
  summary: { total: number; traceable: number; blockedUnapproved: number; atRisk: number; unknownLeadTime: number };
  exportFingerprint: string;
}

function stableRows(rows: readonly SpecificationProcurementReadinessRow[]): SpecificationProcurementReadinessRow[] {
  const seen = new Set<string>();
  return [...rows].sort((a, b) => a.requirementCode.localeCompare(b.requirementCode) || a.requirementId.localeCompare(b.requirementId)).filter(row => {
    if (seen.has(row.requirementId)) throw new Error(`Duplicate readiness requirement: ${row.requirementId}`);
    seen.add(row.requirementId);
    return true;
  });
}

export function buildSpecificationProcurementReadinessView(input: {
  projectId: number;
  generatedAt: string;
  rows: readonly SpecificationProcurementReadinessRow[];
}): SpecificationProcurementReadinessView {
  if (Number.isNaN(Date.parse(input.generatedAt))) throw new Error("A valid generation time is required.");
  const rows = stableRows(input.rows.filter(row => row.projectId === input.projectId && row.chain.projectId === input.projectId));
  const summary = {
    total: rows.length,
    traceable: rows.filter(row => row.chain.procurementEvidenceState === "traceable").length,
    blockedUnapproved: rows.filter(row => row.chain.procurementEvidenceState === "blocked_unapproved").length,
    atRisk: rows.filter(row => row.leadTime.state === "at_risk").length,
    unknownLeadTime: rows.filter(row => row.leadTime.state === "unknown").length,
  };
  const snapshot = rows.map(row => ({ requirementId: row.requirementId, requirementCode: row.requirementCode, sourceUrl: row.sourceUrl, packageUrl: row.packageUrl, procurementEvidenceState: row.chain.procurementEvidenceState, procurementState: row.chain.procurementState, leadTimeState: row.leadTime.state, forecastArrivalDate: row.leadTime.forecastArrivalDate }));
  return { projectId: input.projectId, generatedAt: input.generatedAt, rows, summary, exportFingerprint: crypto.createHash("sha256").update(JSON.stringify(snapshot)).digest("hex") };
}

export function readinessExportRows(view: SpecificationProcurementReadinessView) {
  return view.rows.map(row => ({
    requirement: row.requirementCode,
    title: row.title,
    source: row.sourceUrl,
    reviewPackage: row.packageUrl ?? "Not linked",
    approvalEvidence: row.chain.approvalProven ? row.chain.decisionEvidenceId : "Not proven",
    procurementState: row.chain.procurementState,
    leadTimeState: row.leadTime.state,
    forecastArrival: row.leadTime.forecastArrivalDate ?? "Unknown",
  }));
}
