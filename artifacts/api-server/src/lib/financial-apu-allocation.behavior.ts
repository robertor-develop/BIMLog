import assert from "node:assert/strict";
import { allocateCommercialTotal, evaluateCommercialPrice } from "./financial-correctness-contract";

const commercial = evaluateCommercialPrice({ quantity: "10", unitPrice: "87.33", currency: "USD", overheadPercent: "10", contingencyPercent: "2.5", taxPercent: "7.25" });
assert.equal(commercial.total, "1053.69");
const allocation = allocateCommercialTotal(commercial.total, commercial.currency, [
  { phaseId: "pre", percent: "33.33" },
  { phaseId: "coord", percent: "33.33" },
  { phaseId: "record", percent: "33.34" },
]);
assert.equal(allocation.reconciled, true);
assert.equal(allocation.lines.reduce((sum, line) => sum + Number(line.amount), 0).toFixed(2), commercial.total);
assert.deepEqual(allocation.lines.map(line => line.amount), ["351.19", "351.20", "351.30"]);
assert.throws(() => allocateCommercialTotal("100", "USD", [{ phaseId: "a", percent: "99.99" }]), (error: any) => error.code === "FINANCIAL_PHASE_TOTAL_INVALID");
console.log("Build 053 APU component and phase reconciliation: PASS");
