import assert from "node:assert/strict";
import { isIndependentContractActor } from "./contract-review-controls";
assert.equal(isIndependentContractActor(28, 28), false);
assert.equal(isIndependentContractActor(28, 19), true);
assert.equal(isIndependentContractActor(19, 28), true);
for (const missing of [undefined, null, 0, -1, NaN, "28"]) {
  assert.equal(isIndependentContractActor(missing, 19), false);
  assert.equal(isIndependentContractActor(28, missing), false);
}
console.log("Contract maker presentation: 15 assertions PASS; unknown identity fails closed.");
