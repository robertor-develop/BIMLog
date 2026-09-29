import assert from "node:assert/strict";
import {
  fileIntakeModeTruth,
  fileIntakeRequiresDestination,
  fileIntakeRequiresConvention,
  conventionResolverUrl,
} from "./file-intake-journey";

assert.match(fileIntakeModeTruth("record_only"), /not retained or delivered/);
assert.match(fileIntakeModeTruth("retained_evidence"), /does not deliver/);
assert.match(fileIntakeModeTruth("connected_delivery"), /after confirmation/);
assert.equal(fileIntakeRequiresDestination("record_only"), false);
assert.equal(fileIntakeRequiresDestination("connected_delivery"), true);
assert.equal(fileIntakeRequiresConvention("record_only"), false);
assert.equal(fileIntakeRequiresConvention("retained_evidence"), true);
assert.equal(conventionResolverUrl(42), "/projects/42/generator?returnTo=%2Fprojects%2F42%2Ffiles%3Fresume%3Dfile-intake");

console.log("UX041–UX042 intake modes and convention return PASS");
