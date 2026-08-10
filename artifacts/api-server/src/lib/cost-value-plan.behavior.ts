import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

process.env.PROD_DATABASE_URL = process.env.PROD_DATABASE_URL ?? "postgresql://apu-test:apu-test@127.0.0.1:1/apu-test";
const { CostValuePlanError, validateCostValuePlan } = await import("./cost-value-plan-service");

const balanced = {
  name: "Standard commercial plan", currency: "usd", sellingPrice: "1000.00", fixedCompanyCost: "100.00",
  allocations: { labor: "600.00", bonus: "100.00", taskEarnings: "200.00" },
  laborSplit: { production: "450.00", administrative: "150.00" },
  productionPhases: [
    { id: "phase-design", name: "Design", amount: "150.00" },
    { id: "phase-build", name: "Build", amount: "300.00" },
  ],
  administrativeLines: [
    { id: "admin-pm", name: "Project management", amount: "100.00" },
    { id: "admin-office", name: "Office support", amount: "50.00" },
  ],
};

const result = validateCostValuePlan(balanced);
assert.equal(result.plan.currency, "USD");
assert.equal(result.evaluation.netDistributableValue, "900.00");
assert.equal(result.evaluation.allocationTotal, "900.00");
assert.equal(result.evaluation.productionPhaseTotal, "450.00");
assert.equal(result.evaluation.administrativeLineTotal, "150.00");
assert.deepEqual(result.plan.allocationPercentages, { labor: "66.67", bonus: "11.11", taskEarnings: "22.22" });
assert.deepEqual(result.plan.laborSplitPercentages, { production: "75.00", administrative: "25.00" });
assert.deepEqual(result.plan.productionPhases.map((line) => line.percentage), ["33.33", "66.67"]);
assert.deepEqual(result.plan.administrativeLines.map((line) => line.percentage), ["66.67", "33.33"]);

const rejects = (value: unknown, code: string) => assert.throws(
  () => validateCostValuePlan(value),
  (error: unknown) => error instanceof CostValuePlanError && error.code === code,
);
rejects({ ...balanced, fixedCompanyCost: "1000.01" }, "COST_VALUE_NEGATIVE_DISTRIBUTABLE");
rejects({ ...balanced, allocations: { ...balanced.allocations, bonus: "99.99" } }, "COST_VALUE_ALLOCATION_UNBALANCED");
rejects({ ...balanced, laborSplit: { production: "449.99", administrative: "150.00" } }, "COST_VALUE_LABOR_UNBALANCED");
rejects({ ...balanced, productionPhases: [{ id: "phase-design", name: "Design", amount: "449.99" }] }, "COST_VALUE_PHASES_UNBALANCED");
rejects({ ...balanced, administrativeLines: [{ id: "admin", name: "Admin", amount: "149.99" }] }, "COST_VALUE_ADMIN_UNBALANCED");

const zeroLabor = validateCostValuePlan({
  ...balanced, sellingPrice: "300.00", fixedCompanyCost: "100.00",
  allocations: { labor: "0.00", bonus: "100.00", taskEarnings: "100.00" },
  laborSplit: { production: "0.00", administrative: "0.00" },
  productionPhases: [], administrativeLines: [],
});
assert.equal(zeroLabor.evaluation.productionPhaseTotal, "0.00");
assert.equal(zeroLabor.evaluation.administrativeLineTotal, "0.00");

const percentagePlan = validateCostValuePlan({
  ...balanced, sellingPrice: "120.00", fixedCompanyCost: "20.00", allocationMode: "percentage",
  allocationPercentages: { labor: "70", bonus: "20.0", taskEarnings: "10.00" },
  allocations: { labor: "ignored", bonus: "ignored", taskEarnings: "ignored" },
  laborSplit: { production: "50.00", administrative: "20.00" },
  productionPhases: [{ id: "phase", name: "Production", amount: "50.00" }],
  administrativeLines: [{ id: "admin", name: "Administration", amount: "20.00" }],
});
assert.deepEqual(percentagePlan.plan.allocations, { labor: "70.00", bonus: "20.00", taskEarnings: "10.00" });
assert.deepEqual(percentagePlan.plan.allocationPercentages, { labor: "70.00", bonus: "20.00", taskEarnings: "10.00" });
rejects({ ...balanced, allocationMode: "percentage", allocationPercentages: { labor: "70.001", bonus: "20", taskEarnings: "9.999" } }, "COST_VALUE_PERCENT_INVALID");

const uiRoot = path.resolve("../bimlog/src");
const financialShell = fs.readFileSync(path.join(uiRoot, "components/layout/FinancialProjectShell.tsx"), "utf8");
const plannerWorkspace = fs.readFileSync(path.join(uiRoot, "pages/FinancialApuWorkspace.tsx"), "utf8");
assert.match(financialShell, /className="page-content financial-page-content"/);
assert.match(plannerWorkspace, /padding:24px 24px 104px/);
assert.match(plannerWorkspace, /\.savebar\{position:sticky;bottom:12px/);
assert.match(plannerWorkspace, /Percentages/);
assert.match(plannerWorkspace, /normalizeTwoDecimals/);
assert.match(plannerWorkspace, /Labor Operating Pool/);
assert.match(plannerWorkspace, /Project Incentive Reserve/);
assert.match(plannerWorkspace, /Project Earnings \(automatic remainder\)/);
assert.match(plannerWorkspace, /Use BIM services sample/);
assert.match(plannerWorkspace, /Print \/ Save PDF/);
assert.match(plannerWorkspace, /Export CSV/);
assert.match(plannerWorkspace, /data-testid="cost-value-guide"/);
assert.match(plannerWorkspace, /AllocationRow/);

console.log("Cost & Value Planner validation: passed.");
