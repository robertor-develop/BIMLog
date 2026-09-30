import assert from "node:assert/strict";
import { emptyFinancialContractItem, manualContractRateSource } from "./contract-item-rate-source.ts";
const item = emptyFinancialContractItem({ version: 7, sellingPrice: "12500.00", currency: "USD" });
assert.equal(item.apuPlanVersion, "7");
assert.equal(item.unitRate, "", "a whole-plan selling total must never seed a unit rate");
assert.equal(manualContractRateSource({ unitRate: "30.00", unit: "Hours", currency: "USD", apuPlanVersion: 7 }).unitRate, "30.00");
console.log("contract-item-rate-source.behavior: PASS");
