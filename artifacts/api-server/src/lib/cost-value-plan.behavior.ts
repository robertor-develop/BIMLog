import assert from "node:assert/strict";

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

console.log("Cost & Value Planner validation: passed.");
