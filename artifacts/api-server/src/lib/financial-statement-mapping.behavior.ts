import assert from "node:assert/strict";
import { mapStatementPricing } from "./financial-correctness-contract";
import { normalizeBudgetLines } from "./financial-budget-contract";

const source = { quantityColumn: "Quantity", unitRateColumn: "Unit Rate", totalColumn: "Line Total" };
const valid = mapStatementPricing({ quantity: "12", unitRate: "40000", statedTotal: "480000", currency: "USD", source });
assert.equal(valid.unitPrice, "40000");
assert.equal(valid.total, "480000.00");
assert.deepEqual(valid.source, source);

// Historical defect vector: the whole-plan total was once read as the unit rate.
assert.throws(() => mapStatementPricing({ quantity: "12", unitRate: "480000", statedTotal: "480000", currency: "USD", source }),
  (error: any) => error.code === "FINANCIAL_STATEMENT_TOTAL_MISMATCH" && /5760000\.00/.test(error.message));
assert.throws(() => mapStatementPricing({ quantity: "12", unitRate: "40000", statedTotal: "480000", currency: "USD", source: { ...source, unitRateColumn: "Line Total" } }),
  (error: any) => error.code === "FINANCIAL_STATEMENT_MAPPING_INVALID");
assert.equal(normalizeBudgetLines([{ stableLineId: "LINE-001", projectCostNodeId: "NODE-001", description: "Accepted statement line", amount: "480000", quantity: "12", unitRate: "40000", unit: "LS", sortOrder: 0 }])[0].amount, "480000");
assert.throws(() => normalizeBudgetLines([{ stableLineId: "LINE-001", projectCostNodeId: "NODE-001", description: "Rejected historical mapping", amount: "480000", quantity: "12", unitRate: "480000", unit: "LS", sortOrder: 0 }]),
  (error: any) => error.code === "FINANCIAL_STATEMENT_TOTAL_MISMATCH");
console.log("Build 052 historical statement mapping regression: PASS");
