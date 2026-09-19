import assert from "node:assert/strict";
import { evaluateCommercialPrice } from "./financial-correctness-contract";

const vectors = [
  [{ quantity: "12", unitPrice: "125.50", currency: "USD" }, { quantity: "12", unitPrice: "125.5", base: "1506.00", total: "1506.00" }],
  [{ quantity: "3.333333", unitPrice: "19.995", currency: "USD", overheadPercent: "10", contingencyPercent: "5", taxPercent: "7.25" }, { base: "66.65", overhead: "6.66", contingency: "3.33", subtotal: "76.65", tax: "5.56", total: "82.20" }],
  [{ quantity: "1", unitPrice: "0.005", currency: "BOB" }, { quantity: "1", unitPrice: "0.005", base: "0.01", total: "0.01" }],
] as const;
for (const [input, expected] of vectors) assert.deepEqual(evaluateCommercialPrice(input), { quantity: input.quantity, unitPrice: input.unitPrice, currency: input.currency, overhead: "0.00", contingency: "0.00", subtotal: expected.base, tax: "0.00", rounding: "HALF_UP_MINOR_UNIT", ...expected });
assert.throws(() => evaluateCommercialPrice({ quantity: "1", unitPrice: "2", currency: "ZZZ" }), (error: any) => error.code === "FIN_CURRENCY_INVALID");
assert.throws(() => evaluateCommercialPrice({ quantity: "1", unitPrice: "2", currency: "USD", taxPercent: "100.01" }), (error: any) => error.code === "FINANCIAL_PERCENT_RANGE");
console.log("Build 051 financial golden vectors: PASS");
