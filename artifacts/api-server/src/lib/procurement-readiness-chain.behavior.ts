import assert from "node:assert/strict";
import { buildProcurementReadinessChain } from "./procurement-readiness-chain";

const blocked = buildProcurementReadinessChain({ projectId: 8, requirementId: "REQ-1", packageId: 20, packageRevisionId: "r1", decision: "submitted", decisionEvidenceId: null, materialId: "MAT-1", procurementState: "ordered" });
assert.equal(blocked.procurementEvidenceState, "blocked_unapproved");
assert.equal(blocked.approvalProven, false, "submitted is not approved");
const missingEvidence = buildProcurementReadinessChain({ ...blocked, decision: "approved", decisionEvidenceId: null });
assert.equal(missingEvidence.procurementEvidenceState, "blocked_unapproved", "approval label without exact evidence does not prove procurement readiness");
const traceable = buildProcurementReadinessChain({ ...blocked, decision: "approved_as_noted", decisionEvidenceId: "decision-7" });
assert.equal(traceable.procurementEvidenceState, "traceable");
assert.equal(traceable.warning, null);
assert.throws(() => buildProcurementReadinessChain({ ...blocked, materialId: null }), /material identity/);
console.log("C068 requirement-to-procurement traceability: PASS");
