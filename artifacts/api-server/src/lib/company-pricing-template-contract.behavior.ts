import assert from "node:assert/strict";
import { validatePricingTemplate, resolvePricingPoolAmounts } from "./company-pricing-template-contract";
import { createHash } from "node:crypto";

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
assert.equal(first.fingerprint,createHash("sha256").update(JSON.stringify(valid)).digest("hex"));
assert.equal(Object.hasOwn(first.definition,"economicPools"),false);
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
const classified = {...withPhases.definition,economicPools:{fixedCompanyCost:[],directProduction:["labor"],projectAdministration:["review"],incentiveReserve:[],projectEarnings:[]}};
assert.deepEqual(resolvePricingPoolAmounts(classified).amounts,{fixedCompanyCost:"0.00",directProduction:"250.00",projectAdministration:"50.00",incentiveReserve:"0.00",projectEarnings:"0.00"});
assert.equal(resolvePricingPoolAmounts(classified).total,"300.00");
const halfCents = {...classified,nodes:classified.nodes.map(node=>({id:node.id,label:node.label,method:"fixed_amount",amount:"0.005"}))};
assert.equal(resolvePricingPoolAmounts(halfCents).total,"0.01");
assert.equal(resolvePricingPoolAmounts(halfCents).amounts.directProduction,"0.01");
assert.equal(resolvePricingPoolAmounts(halfCents).amounts.projectAdministration,"0.00");
assert.equal(resolvePricingPoolAmounts({...halfCents,nodes:halfCents.nodes.map(node=>({...node,amount:"0"}))}).total,"0.00");
assert.notEqual(validatePricingTemplate(classified).fingerprint,withPhases.fingerprint);
assert.equal(validatePricingTemplate(JSON.parse(JSON.stringify(classified))).fingerprint,validatePricingTemplate(classified).fingerprint);
const denyPools=(economicPools:unknown,code:string)=>assert.throws(()=>validatePricingTemplate({...classified,economicPools}),(e:any)=>e.code===code);
denyPools({...classified.economicPools,incentiveReserve:["labor"]},"PRICING_TEMPLATE_POOL_NODE_INVALID");
denyPools({...classified.economicPools,projectAdministration:[]},"PRICING_TEMPLATE_POOL_NODE_UNASSIGNED");
denyPools({...classified.economicPools,projectAdministration:["missing"]},"PRICING_TEMPLATE_POOL_NODE_INVALID");
denyPools({...classified.economicPools,projectAdministration:["review","review"]},"PRICING_TEMPLATE_POOL_NODE_INVALID");
denyPools({...classified.economicPools,directProduction:["review"],projectAdministration:["labor"]},"PRICING_TEMPLATE_POOL_PRODUCTION_MISMATCH");
denyPools({...classified.economicPools,projectAdministration:null},"PRICING_TEMPLATE_POOLS_INVALID");
denyPools({...classified.economicPools,taskEarnings:[]},"PRICING_TEMPLATE_UNKNOWN_FIELD");
assert.throws(()=>resolvePricingPoolAmounts(valid),(e:any)=>e.code==="PRICING_TEMPLATE_POOLS_REQUIRED");
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
