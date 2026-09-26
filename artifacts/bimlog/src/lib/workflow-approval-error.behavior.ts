import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
assert.match(workflowApprovalError("WORKFLOW_TEXT_INVALID", true, "phases[0].code"), /^Fase 1 · Código: Complete/);
assert.match(workflowApprovalError("WORKFLOW_TEXT_INVALID", false, "phases[1].tasks[2].name"), /^Phase 2 · Task 3 · Name: Complete/);
assert.doesNotMatch(workflowApprovalError("WORKFLOW_CODE_INVALID", true, "untrusted-private-content"), /untrusted-private-content|WORKFLOW_CODE_INVALID/);
assert.match(workflowApprovalError("WORKFLOW_DUPLICATE_ID", false), /unique code/);
assert.match(workflowApprovalError("WORKFLOW_ARRAY_SIZE_INVALID", true), /al menos una fase/);
for (const code of ["WORKFLOW_APU_NOT_FOUND","WORKFLOW_APU_PHASE_DEFAULTS_MISSING","WORKFLOW_ALLOCATION_PHASE_MISMATCH","ALLOCATION_TOTAL_NOT_100","ALLOCATION_DECIMAL_INVALID","ALLOCATION_DEDUCTION_MISMATCH","ALLOCATION_DEDUCTION_EXCEEDS_PHASE","ALLOCATION_ADDITION_TOO_LARGE"]) {
  assert.notEqual(workflowApprovalError(code, true), code);
  assert.notEqual(workflowApprovalError(code, false), code);
  assert.notEqual(workflowApprovalError(code, true), workflowApprovalError(code, false));
}
const policyPage = readFileSync(new URL("../pages/CompanyWorkflowGovernance.tsx", import.meta.url), "utf8");
assert.match(policyPage, /Replacement versions also enforce prohibitions/);
assert.match(policyPage, /Las versiones de reemplazo también aplican las prohibiciones/);
assert.doesNotMatch(policyPage, /other change rules|las demás reglas de cambio/);
for (const action of ["EDIT_PHASES", "EDIT_TASKS_ROLES", "CHANGE_APU", "EDIT_ALLOCATION"]) {
  assert.match(workflowApprovalError(`WORKFLOW_POLICY_${action}_FORBIDDEN`,true), /La versión publicada sigue vigente/);
  assert.match(workflowApprovalError(`WORKFLOW_POLICY_${action}_FORBIDDEN`,false), /published version remains in effect/);
}
