import assert from "node:assert/strict";
import {
  fileIntakeModeTruth,
  fileIntakeRequiresDestination,
} from "./file-intake-journey";

assert.match(fileIntakeModeTruth("record_only"), /not retained or delivered/);
assert.match(fileIntakeModeTruth("retained_evidence"), /does not deliver/);
assert.match(fileIntakeModeTruth("connected_delivery"), /after confirmation/);
assert.equal(fileIntakeRequiresDestination("record_only"), false);
assert.equal(fileIntakeRequiresDestination("connected_delivery"), true);

console.log("UX041 explicit file-intake modes PASS");
