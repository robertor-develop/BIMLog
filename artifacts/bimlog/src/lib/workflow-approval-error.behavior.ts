import assert from "node:assert/strict";
import { workflowApprovalError } from "./workflow-approval-error";

assert.match(workflowApprovalError("DELIVERY_WORKFLOW_INDEPENDENT_CHECKER_REQUIRED", false), /Another company PMO/);
assert.match(workflowApprovalError("DELIVERY_WORKFLOW_INDEPENDENT_CHECKER_REQUIRED", true), /Otro administrador PMO/);
assert.match(workflowApprovalError("DELIVERY_WORKFLOW_FINANCE_CHECKER_REQUIRED", false), /Finance approver/);
assert.match(workflowApprovalError("WORKFLOW_POLICY_FINAL_APPROVAL_REQUIRED", true), /aprobación final/);
assert.match(workflowApprovalError("WORKFLOW_POLICY_PHASE_REVIEW_REQUIRED", false), /every phase/);
assert.match(workflowApprovalError("WORKFLOW_POLICY_DOCUMENT_REQUIRED", true), /documento requerido/);
assert.match(workflowApprovalError("WORKFLOW_POLICY_FINGERPRINT_MISMATCH", false), /PMO administrator/);
assert.equal(workflowApprovalError("OTHER_ERROR", true), "OTHER_ERROR");
assert.match(workflowApprovalError("WORKFLOW_PREVIEW_CONTEXT_INVALID", true), /seleccione nuevamente/);
assert.match(workflowApprovalError("DELIVERY_WORKFLOW_NOT_FOUND", false), /Reload the list/);
console.log("Workflow approval guidance: pass");
for (const action of ["EDIT_PHASES", "EDIT_TASKS_ROLES", "CHANGE_APU", "EDIT_ALLOCATION"]) {
  assert.match(workflowApprovalError(`WORKFLOW_POLICY_${action}_FORBIDDEN`,true), /La versión publicada sigue vigente/);
  assert.match(workflowApprovalError(`WORKFLOW_POLICY_${action}_FORBIDDEN`,false), /published version remains in effect/);
}
