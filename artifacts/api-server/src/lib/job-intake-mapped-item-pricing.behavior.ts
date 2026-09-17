import assert from "node:assert/strict";
import fs from "node:fs";
import { mergeMappedContractItems } from "./job-intake-mapped-item-pricing";

const existing = { id: "CI-1", name: "Old", plannedHours: "40", billingHourlyRate: "75", apuPlanVersion: null };
const mappedRows = [
  { id: "CI-1", name: "L2 Shop", quantity: "80", provenance: { sourceRow: 2 } },
  { id: "CI-2", name: "L3 Shop", quantity: "20", provenance: { sourceRow: 3 } },
];
const base = {
  existingItems: [existing], mappedRows,
  candidatePlans: [{ version: 1, content: { currency: "USD", sellingPrice: "6000" } }],
  currency: "USD", workflowTemplate: "bim-submittal", defaultContractId: "C-1",
};
const result = mergeMappedContractItems(base);
assert.equal(result[0].billingHourlyRate, "75");
assert.equal(result[0].plannedHours, "80");
assert.equal(result[1].billingHourlyRate, "0");
assert.equal(result[1].apuPlanVersion, 1);
assert.equal(result[1].contractValue, "0");
assert.equal(result[0].plannedHours * Number(result[0].billingHourlyRate), 6000);
assert.equal(mergeMappedContractItems({ ...base, candidatePlans: [base.candidatePlans[0], { version: 2, content: { currency: "USD" } }] })[1].apuPlanVersion, null);
assert.equal(mergeMappedContractItems({ ...base, currency: "BOB" })[1].apuPlanVersion, null);
const service = fs.readFileSync(new URL("./job-intake-service.ts", import.meta.url), "utf8");
assert.match(service, /mergeMappedContractItems\(\{/);
console.log("job-intake-mapped-item-pricing: PASS");
