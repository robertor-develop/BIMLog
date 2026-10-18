import assert from "node:assert/strict";
import { contractItemRateExplanation } from "./contract-item-rate-source";

const derived={kind:"saved_apu_rate",apuPlanVersion:7,rateCalculation:"plan_total_divided_by_contract_quantity",planSellingPrice:"1250.00",unitRate:"125"};
assert.equal(contractItemRateExplanation(derived,"10"),"APU v7: plan total 1250.00 ÷ quantity 10 = unit rate 125.");
assert.equal(contractItemRateExplanation(derived,"10",true),"APU v7: total del plan 1250.00 ÷ cantidad 10 = tarifa unitaria 125.");
assert.equal(contractItemRateExplanation({kind:"saved_apu_rate",apuPlanVersion:2,rateCalculation:"published_unit_rate",unitRate:"45"},"8"),"APU v2: published unit rate 45.");
assert.equal(contractItemRateExplanation({kind:"manual_contract_rate"},"8"),null);
console.log("contract item APU rate explanation: PASS");
