import assert from "node:assert/strict";
import {
  isLaunchReadinessState,
  launchReadinessStates,
  ownerReservedLaunchFields,
  inspectBusinessIdentity,
} from "./launch-configuration";

assert.equal(launchReadinessStates.length, 6);
assert.equal(isLaunchReadinessState("GA_CANDIDATE_CONFIGURATION_READY"), true);
assert.equal(isLaunchReadinessState("GENERAL_AVAILABILITY_APPROVED"), true);
assert.equal(isLaunchReadinessState("READY"), false);
assert.equal(new Set(ownerReservedLaunchFields).size, ownerReservedLaunchFields.length);

const incompleteIdentity = inspectBusinessIdentity({ legalBusinessName: "Synthetic Test Company" });
assert.equal(incompleteIdentity.status, "invalid");
assert.ok(incompleteIdentity.issues.includes("country_required"));

const readyIdentity = inspectBusinessIdentity({
  legalBusinessName: "Synthetic Test Company",
  tradeName: "Synthetic BIM",
  businessIdentificationNumber: "TEST-0001",
  country: "Test Country",
  jurisdiction: "Test Jurisdiction",
  businessAddress: "100 Test Avenue",
  billingAddress: "100 Test Avenue",
  supportEmail: "support@example.test",
  billingEmail: "billing@example.test",
});
assert.equal(readyIdentity.status, "ready");
assert.deepEqual(readyIdentity.issues, []);

console.log("LAUNCH_CONFIGURATION_BUILD_01=PASS states=6 ownerReserved=true");
console.log("LAUNCH_CONFIGURATION_BUILD_02=PASS syntheticBusinessIdentity=true");
