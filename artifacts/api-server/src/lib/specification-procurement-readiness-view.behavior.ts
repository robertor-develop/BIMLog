import assert from "node:assert/strict";
import { buildSpecificationProcurementReadinessView, readinessExportRows } from "./specification-procurement-readiness-view";

const row = {
  projectId: 8, requirementId: "REQ-1", requirementCode: "23 31 00-DUCT", title: "Duct product data", sourceUrl: "/projects/8/files/41/revisions/rev-b?page=12", packageUrl: "/projects/8/submittals/20",
  chain: { projectId: 8, requirementId: "REQ-1", packageId: 20, packageRevisionId: "r2", decision: "approved" as const, decisionEvidenceId: "decision-7", materialId: "MAT-1", procurementState: "ordered" as const, approvalProven: true, procurementEvidenceState: "traceable" as const, warning: null },
  leadTime: { state: "on_track" as const, forecastArrivalDate: "2026-10-08", requiredOnSiteDate: "2026-10-09", contractualMilestoneDate: "2026-10-20", reason: "Forecast arrival is on or before the required-on-site date." },
};
const view = buildSpecificationProcurementReadinessView({ projectId: 8, generatedAt: "2026-09-28T17:00:00Z", rows: [row, { ...row, projectId: 9, requirementId: "foreign", chain: { ...row.chain, projectId: 9 } }] });
assert.deepEqual(view.summary, { total: 1, traceable: 1, blockedUnapproved: 0, atRisk: 0, unknownLeadTime: 0 });
const exported = readinessExportRows(view);
assert.equal(exported.length, view.rows.length, "view and export reconcile to the same scoped rows");
assert.equal(exported[0]?.approvalEvidence, "decision-7", "one requirement traces through review and downstream state");
assert.match(view.exportFingerprint, /^[0-9a-f]{64}$/);
assert.throws(() => buildSpecificationProcurementReadinessView({ projectId: 8, generatedAt: "2026-09-28T17:00:00Z", rows: [row, row] }), /Duplicate readiness requirement/);
console.log("C070 specification/procurement readiness view and export: PASS");
