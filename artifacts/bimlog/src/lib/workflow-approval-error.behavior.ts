import assert from "node:assert/strict";
import { workflowApprovalError } from "./workflow-approval-error";

assert.match(workflowApprovalError("DELIVERY_WORKFLOW_INDEPENDENT_CHECKER_REQUIRED", false), /Another company PMO/);
assert.match(workflowApprovalError("DELIVERY_WORKFLOW_INDEPENDENT_CHECKER_REQUIRED", true), /Otro administrador PMO/);
assert.match(workflowApprovalError("DELIVERY_WORKFLOW_FINANCE_CHECKER_REQUIRED", false), /Finance approver/);
assert.equal(workflowApprovalError("OTHER_ERROR", true), "OTHER_ERROR");
console.log("Workflow approval guidance: pass");
