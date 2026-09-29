import assert from "node:assert/strict";
import {
  fileIntakeModeTruth,
  fileIntakeRequiresDestination,
  fileIntakeRequiresConvention,
  conventionResolverUrl,
  fileIntakePreview,
  fileIntakeCanSubmit,
} from "./file-intake-journey";

assert.match(fileIntakeModeTruth("record_only"), /not retained or delivered/);
assert.match(fileIntakeModeTruth("retained_evidence"), /does not deliver/);
assert.match(fileIntakeModeTruth("connected_delivery"), /after confirmation/);
assert.equal(fileIntakeRequiresDestination("record_only"), false);
assert.equal(fileIntakeRequiresDestination("connected_delivery"), true);
assert.equal(fileIntakeRequiresConvention("record_only"), false);
assert.equal(fileIntakeRequiresConvention("retained_evidence"), true);
assert.equal(conventionResolverUrl(42), "/projects/42/generator?returnTo=%2Fprojects%2F42%2Ffiles%3Fresume%3Dfile-intake");
assert.deepEqual(fileIntakePreview({ fileName: "A.pdf", mode: "record_only" }), { fileName: "A.pdf", retainsBytes: false, destination: null, delivers: false, ai: { requested: false, estimate: "No AI cost" } });
assert.equal(fileIntakePreview({ fileName: "A.pdf", mode: "connected_delivery", destinationLabel: null }).delivers, false);
assert.equal(fileIntakeCanSubmit("record_only"), true);
assert.equal(fileIntakeCanSubmit("retained_evidence"), false);

console.log("UX041–UX043 intake modes, convention return and truthful preview PASS");
