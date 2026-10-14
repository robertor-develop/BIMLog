import assert from "node:assert/strict";
import { inspectLaunchActivationPreflight } from "./launch-activation-preflight";

const pending = inspectLaunchActivationPreflight({ environment: "production", configurationRevision: 4, configurationEntered: false, active: false, emailProvider: "smtp", emailEvidence: null, selectedPaymentMethods: ["bank_transfer"], paymentEvidence: [] });
assert.equal(pending.classification, "LAUNCH_CONFIGURATION_PENDING");
assert.deepEqual(pending.blockers, ["launch_configuration_incomplete", "transactional_email_verification_missing", "bank_transfer_verification_missing"]);

const candidate = inspectLaunchActivationPreflight({ environment: "production", configurationRevision: 4, configurationEntered: true, active: false, emailProvider: "smtp", emailEvidence: { provider: "smtp", status: "verified" }, selectedPaymentMethods: ["bank_transfer"], paymentEvidence: [{ method: "bank_transfer", mode: "manual", status: "configured", revision: 4 }] });
assert.equal(candidate.classification, "GA_CANDIDATE");
assert.equal(candidate.activationReady, true);

const active = inspectLaunchActivationPreflight({ ...candidate, environment: "production", configurationEntered: true, active: true, emailProvider: "smtp", emailEvidence: { provider: "smtp", status: "sent" }, selectedPaymentMethods: ["bank_transfer"], paymentEvidence: [{ method: "bank_transfer", mode: "manual", status: "configured", revision: 4 }] });
assert.equal(active.classification, "FINAL_ACTIVATION_VERIFIED");

console.log("LAUNCH_CONFIGURATION_BUILD_36=PASS classifications=3 evidenceBound=true");
