import assert from "node:assert/strict";
import {
  guardedConventionPhase,
  resolveCheckpointContinuation,
  resolveSetupContinuation,
} from "./convention-navigation";

assert.equal(guardedConventionPhase("completed", "setup_context"), "checkpoint");
assert.equal(guardedConventionPhase("completed", "edit_foundation"), "edit_foundation");
assert.equal(guardedConventionPhase("not_started", "checkpoint"), "setup_context");
assert.equal(guardedConventionPhase("in_progress", "changes_review"), "setup_context");
assert.equal(resolveCheckpointContinuation(true).step, 4);
assert.equal(resolveSetupContinuation({
  setupContextChoice: "new",
  projectEnvironment: "standard",
  builderIntent: "create_scratch",
  analysisOnlyMode: false,
}), "main_wizard");

console.log("convention-navigation.behavior: PASS saved conventions reopen at their checkpoint");
