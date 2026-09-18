import assert from "node:assert/strict";
import { BIMLOG_DELIVERY_WORKFLOWS } from "./delivery-workflow-defaults";
import { chooseDeliveryWorkflow } from "./delivery-workflow-selection";

const defaults = { mode: "defaults_allowed" as const, options: [...BIMLOG_DELIVERY_WORKFLOWS] };
assert.equal(chooseDeliveryWorkflow(defaults, "GENERAL", "").option.code, "GENERAL");
assert.equal(chooseDeliveryWorkflow(defaults, "SHOP_DRAWING", "").option.code, "SHOP_DRAWING");
assert.equal(chooseDeliveryWorkflow(defaults, "SLEEVE", "").option.code, "SLEEVE");
const company = { ...BIMLOG_DELIVERY_WORKFLOWS[1], versionId: "company-1", templateId: "template-1", source: "company" as const };
assert.equal(chooseDeliveryWorkflow({ mode: "defaults_allowed", options: [...defaults.options, company] }, "SHOP_DRAWING", "").option.versionId, "company-1");
assert.throws(() => chooseDeliveryWorkflow({ mode: "defaults_allowed", options: [...defaults.options, company, { ...company, versionId: "company-2" }] }, "SHOP_DRAWING", ""), /Multiple company Delivery Workflows/);
assert.equal(chooseDeliveryWorkflow({ mode: "defaults_allowed", options: [...defaults.options, company, { ...company, versionId: "company-2" }] }, "SHOP_DRAWING", "company-2").option.versionId, "company-2");
assert.throws(() => chooseDeliveryWorkflow({ mode: "approved_only", options: [company] }, "SLEEVE", ""), /approved Delivery Workflow/);
assert.throws(() => chooseDeliveryWorkflow({ mode: "approved_only", options: [company] }, "SHOP_DRAWING", "bimlog:SHOP_DRAWING:1"), /unavailable/);
console.log("Delivery Workflow selection: defaults, sole company, multiple company, explicit selection, and approved-only gates passed.");
