import assert from "node:assert/strict";
import { workflowPolicyErrorMessage } from "./workflow-policy-error";

assert.match(workflowPolicyErrorMessage("WORKFLOW_POLICY_INDEPENDENT_CHECKER_REQUIRED", false), /different company PMO/);
assert.match(workflowPolicyErrorMessage("WORKFLOW_POLICY_INDEPENDENT_CHECKER_REQUIRED", true), /Otro administrador PMO/);
assert.match(workflowPolicyErrorMessage("WORKFLOW_POLICY_FINANCE_CHECKER_REQUIRED", false), /Finance cost-approver/);
assert.match(workflowPolicyErrorMessage("WORKFLOW_POLICY_REASON_REQUIRED", true), /5 a 500/);
assert.doesNotMatch(workflowPolicyErrorMessage("DATABASE_PRIVATE_DETAIL", false), /DATABASE_PRIVATE_DETAIL/);
console.log("Workflow Governance error guidance: bilingual checker, Finance, retirement and safe fallback PASS");
