import assert from "node:assert/strict";
import { accessibleFieldIds, describedBy } from "./accessible-form";

const ids = accessibleFieldIds("budget-rate");
assert.deepEqual(ids, {
  controlId: "budget-rate-form-item",
  descriptionId: "budget-rate-form-item-description",
  errorId: "budget-rate-form-item-message",
});
assert.equal(describedBy(ids, false), ids.descriptionId);
assert.equal(describedBy(ids, true), `${ids.descriptionId} ${ids.errorId}`);
assert.equal(new Set(Object.values(ids)).size, 3);
console.log("post120 Build 189 accessible interactions: PASS");
