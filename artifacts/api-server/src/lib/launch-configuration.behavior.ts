import assert from "node:assert/strict";
import {
  isLaunchReadinessState,
  launchReadinessStates,
  ownerReservedLaunchFields,
} from "./launch-configuration";

assert.equal(launchReadinessStates.length, 6);
assert.equal(isLaunchReadinessState("GA_CANDIDATE_CONFIGURATION_READY"), true);
assert.equal(isLaunchReadinessState("GENERAL_AVAILABILITY_APPROVED"), true);
assert.equal(isLaunchReadinessState("READY"), false);
assert.equal(new Set(ownerReservedLaunchFields).size, ownerReservedLaunchFields.length);

console.log("LAUNCH_CONFIGURATION_BUILD_01=PASS states=6 ownerReserved=true");
