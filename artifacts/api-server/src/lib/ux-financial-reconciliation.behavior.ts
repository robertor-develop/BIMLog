import assert from "node:assert/strict";
import { reconcileFinancialAuthority, type FinancialReconciliationSnapshot } from "./ux-financial-reconciliation";

const accepted: FinancialReconciliationSnapshot = {
  currency: "USD",
  totals: { contractValue: "30000.000000", plannedLabor: "3825.00", approvedBaseline: "26175" },
  versionIds: ["contract-v3", "apu-v2"],
  approvalIds: ["approval-contract-v3", "approval-budget-v1"],
  roleGrants: ["finance:reviewer:7", "project:manager:2"],
};
const equivalent: FinancialReconciliationSnapshot = {
  ...accepted,
  totals: { contractValue: "30000", plannedLabor: "3825.000000", approvedBaseline: "26175.0" },
  versionIds: [...accepted.versionIds].reverse(),
  approvalIds: [...accepted.approvalIds].reverse(),
  roleGrants: [...accepted.roleGrants].reverse(),
};
assert.equal(reconcileFinancialAuthority(accepted, equivalent).status, "pass");

const changed = reconcileFinancialAuthority(accepted, {
  ...equivalent,
  totals: { ...equivalent.totals, plannedLabor: "3825.000001" },
  roleGrants: ["project:manager:2"],
});
assert.equal(changed.status, "mismatch");
assert.deepEqual(changed.mismatches.map((item) => item.field), ["total:plannedLabor", "roleGrants"]);
assert.throws(() => reconcileFinancialAuthority(accepted, { ...equivalent, totals: { ...equivalent.totals, plannedLabor: "NaN" } }), /INVALID_EXACT/);
console.log("UX093 financial, snapshot and permission reconciliation: PASS");
