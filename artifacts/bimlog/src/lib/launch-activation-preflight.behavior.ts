import assert from "node:assert/strict";
import { parseLaunchActivationPreflight } from "./launch-activation-preflight";

const parsed = parseLaunchActivationPreflight({ environment: "production", configurationRevision: 7, configurationReady: true, emailReady: true, paymentsReady: true, activationReady: true, classification: "GA_CANDIDATE", blockers: [] });
assert.equal(parsed?.classification, "GA_CANDIDATE");
assert.equal(parseLaunchActivationPreflight(null), null);
assert.throws(() => parseLaunchActivationPreflight({ ...parsed, activationReady: false }), /CONTRADICTORY/);
assert.throws(() => parseLaunchActivationPreflight({ ...parsed, blockers: ["unsafe blocker!"] }), /INVALID/);
assert.throws(() => parseLaunchActivationPreflight({ ...parsed, environment: "customer" }), /INVALID/);

console.log("LAUNCH_CONFIGURATION_BUILD_38=PASS strictBrowserContract=true contradictions=denied");
