import assert from "node:assert/strict";
import { verifyFailureJourneys, type FailureJourneyObservation } from "./ux-failure-journey";

const base = (scenario: FailureJourneyObservation["scenario"], mutationCount: number): FailureJourneyObservation => ({
  scenario, inputFingerprintBefore: "sha256:input", inputFingerprintAfter: "sha256:input", mutationCount,
  exposedRecordIds: scenario.endsWith("denial") ? [] : ["record-1"], authorizedRecordIds: ["record-1"],
});
const valid = [base("recoverable_retry", 1), base("date_boundary", 1), base("permission_denial", 0), base("cross_tenant_denial", 0)];
assert.equal(verifyFailureJourneys(valid).status, "passed");
assert.equal(verifyFailureJourneys(valid.map((item) => item.scenario === "recoverable_retry" ? { ...item, mutationCount: 2 } : item)).status, "blocked");
assert.equal(verifyFailureJourneys(valid.map((item) => item.scenario === "cross_tenant_denial" ? { ...item, exposedRecordIds: ["other-tenant"] } : item)).status, "blocked");
assert.equal(verifyFailureJourneys(valid.slice(1)).status, "blocked");
console.log("UX097 failure, retry, date, permission and tenant journeys: PASS");
