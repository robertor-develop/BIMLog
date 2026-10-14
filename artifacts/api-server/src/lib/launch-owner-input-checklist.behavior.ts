import assert from "node:assert/strict";
import { inspectLaunchOwnerInputChecklist } from "./launch-owner-input-checklist";

const pending = inspectLaunchOwnerInputChecklist({ configured: false, active: false, preflight: null });
assert.equal(pending.classification, "LAUNCH_CONFIGURATION_PENDING");
assert.equal(pending.productCodeBlocked, false);
assert.equal(pending.pendingCount, 6);
assert.equal(new Set(pending.items.map(item => item.id)).size, 6);

const verified = inspectLaunchOwnerInputChecklist({ configured: true, active: true, preflight: {
  environment: "production", configurationRevision: 7,
  classification: "FINAL_ACTIVATION_VERIFIED", configurationReady: true, emailReady: true,
  paymentsReady: true, activationReady: true, blockers: [],
} });
assert.equal(verified.classification, "FINAL_ACTIVATION_VERIFIED");
assert.equal(verified.pendingCount, 0);
assert.ok(verified.items.every(item => !item.pending));
console.log("PASS exact owner launch-input checklist (7 checks)");
