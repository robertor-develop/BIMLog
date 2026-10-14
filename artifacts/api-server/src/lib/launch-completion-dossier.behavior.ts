import assert from "node:assert/strict";
import { inspectLaunchCompletionDossier } from "./launch-completion-dossier";

const pending = inspectLaunchCompletionDossier({ preflight: null, pendingOwnerSteps: 6 });
assert.equal(pending.classification, "LAUNCH_CONFIGURATION_PENDING");
assert.equal(pending.ownerActionRequired, true);
assert.equal(pending.pendingOwnerSteps, 6);
assert.equal(pending.coreProductReady, true);
assert.equal(pending.saasProductionReady, true);
assert.equal(pending.historicalIntegrityDeclared, true);

const candidate = inspectLaunchCompletionDossier({ preflight: {
  environment: "production", configurationRevision: 7, configurationReady: true,
  emailReady: true, paymentsReady: true, activationReady: true,
  classification: "GA_CANDIDATE", blockers: [],
}, pendingOwnerSteps: 1 });
assert.equal(candidate.classification, "GA_CANDIDATE");
assert.equal(candidate.ownerActionRequired, true);

const verified = inspectLaunchCompletionDossier({ preflight: {
  environment: "production", configurationRevision: 8, configurationReady: true,
  emailReady: true, paymentsReady: true, activationReady: true,
  classification: "FINAL_ACTIVATION_VERIFIED", blockers: [],
}, pendingOwnerSteps: 0 });
assert.equal(verified.classification, "FINAL_ACTIVATION_VERIFIED");
assert.equal(verified.ownerActionRequired, false);
console.log("PASS truthful launch completion dossier (10 checks)");
