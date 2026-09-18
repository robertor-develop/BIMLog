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
assert.equal(Object.hasOwn(first.definition, "economicAllocation"), false);
assert.equal(validatePricingTemplate(valid).fingerprint, first.fingerprint);
const withPhases = validatePricingTemplate({ ...valid, economicAllocation: {
  directProductionNodeIds: ["labor"],
  phases: [
    { phaseId: "pre", code: "PRE", name: "Preliminary", percent: "45.00" },
    { phaseId: "coord", code: "COORD", name: "Coordination", percent: "35.00" },
    { phaseId: "record", code: "FR", name: "For Record", percent: "15.00" },
    { phaseId: "built", code: "AB", name: "As-Built", percent: "5.00" },
  ],
} });
assert.notEqual(withPhases.fingerprint, first.fingerprint);
assert.equal(withPhases.definition.economicAllocation?.phases.length, 4);
assert.throws(() => validatePricingTemplate({ ...valid, economicAllocation: {
  ...withPhases.definition.economicAllocation, phases: withPhases.definition.economicAllocation!.phases.slice(0, 3),
} }), (error: any) => error.code === "PRICING_TEMPLATE_PHASE_TOTAL_INVALID");
assert.throws(() => validatePricingTemplate({ ...valid, economicAllocation: {
  ...withPhases.definition.economicAllocation, directProductionNodeIds: ["unknown"],
} }), (error: any) => error.code === "PRICING_TEMPLATE_PRODUCTION_NODE_UNKNOWN");
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
