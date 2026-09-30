import assert from "node:assert/strict";
import { applyShopDrawingPreset, isBimtechDeliveryCompany } from "./shop-drawing-delivery";

assert.equal(isBimtechDeliveryCompany(["BIMTech Corp."]), true);
assert.deepEqual(applyShopDrawingPreset([{ id:"a", deliverableType:"GENERAL" }, { id:"b", deliverableType:"SLEEVE" }], true), [
  { id:"a", deliverableType:"SHOP_DRAWING", workflowTemplate:"bim-submittal" }, { id:"b", deliverableType:"SLEEVE" },
]);
assert.deepEqual(applyShopDrawingPreset([{ id:"a", deliverableType:"GENERAL" }], false), [{ id:"a", deliverableType:"GENERAL" }]);
console.log("UX141_RESULT=PASS BIMtech defaults untouched new scope to shop drawings while explicit and non-BIMtech choices remain configurable");
