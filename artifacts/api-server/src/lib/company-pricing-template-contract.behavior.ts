import assert from "node:assert/strict";
import { validatePricingTemplate } from "./company-pricing-template-contract";

const valid = {
  schemaVersion: 1,
  currency: "USD",
  industry: "BIM Services",
  name: "Shop Drawing Production",
  nodes: [
    { id: "labor", label: "Drawing labor", method: "hours_hourly_rate", hours: "10", hourlyRate: "25" },
    { id: "review", label: "Review", method: "fixed_amount", amount: "50" },
  ],
};
const first = validatePricingTemplate(valid);
assert.equal(first.preview.roundedTotal, "300.00");
assert.equal(first.definition.nodes.length, 2);
assert.equal(validatePricingTemplate(valid).fingerprint, first.fingerprint);
assert.notEqual(validatePricingTemplate({ ...valid, nodes: [{ ...valid.nodes[0], hours: "11" }, valid.nodes[1]] }).fingerprint, first.fingerprint);
assert.throws(() => validatePricingTemplate({ ...valid, nodes: [valid.nodes[0], valid.nodes[0]] }),
  (error: any) => error.code === "PRICING_TEMPLATE_DUPLICATE_NODE");
assert.throws(() => validatePricingTemplate({ ...valid, nodes: [{ ...valid.nodes[0], hours: "-1" }] }),
  (error: any) => error.code === "APU_INVALID_INPUT");
assert.throws(() => validatePricingTemplate({ ...valid, nodes: [{ id: "formula", label: "Formula", method: "formula", expression: "1+1" }] }),
  (error: any) => error.code === "PRICING_TEMPLATE_METHOD_UNSUPPORTED");
assert.throws(() => validatePricingTemplate({ ...valid, tenantId: 999 }),
  (error: any) => error.code === "PRICING_TEMPLATE_UNKNOWN_FIELD");
console.log("company pricing-template contract: PASS");
