import assert from "node:assert/strict";
import { BIMLOG_BUDGET_GOVERNANCE_POLICIES, BIMLOG_DELIVERY_METHODS, DEFAULT_BUDGET_GOVERNANCE_POLICY, DEFAULT_DELIVERY_METHOD, normalizeBudgetGovernancePolicy } from "./job-intake-configuration";

assert.equal(DEFAULT_DELIVERY_METHOD, "bim-submittal");
assert.equal(DEFAULT_BUDGET_GOVERNANCE_POLICY, "standard");
assert.equal(BIMLOG_DELIVERY_METHODS.length, 3);
assert.equal(BIMLOG_BUDGET_GOVERNANCE_POLICIES.length, 3);
assert.equal(normalizeBudgetGovernancePolicy("pmo-controlled"), "pmo-controlled");
assert.equal(normalizeBudgetGovernancePolicy("invented"), "standard");
console.log("job-intake-configuration: PASS");
