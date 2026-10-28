import assert from "node:assert/strict";
import fs from "node:fs";

const contract = JSON.parse(fs.readFileSync(new URL("../evidence/revision2-r01-r05/R04_USER_JOURNEY_RECONCILIATION.json", import.meta.url)));
const expectedRules = [
  "complete_frontend_backend_parity", "role_based_organization_without_capability_removal", "two_navigation_levels",
  "guided_journeys_and_direct_expert_access", "explain_instead_of_conceal", "operational_dashboards",
  "visible_lifecycle_states", "capability_parity_classification", "no_essential_work_hidden_as_advanced",
  "novice_comprehension_and_expert_power"
];

assert.deepEqual(contract.requirements.map(({ rule }) => rule), expectedRules);
assert.equal(contract.requirements.length, 10);
assert.equal(contract.navigationModel.fullCapabilityLevel.label, "All Tools");
assert.equal(contract.navigationModel.fullCapabilityLevel.currentState, "missing");
assert.deepEqual(contract.navigationModel.primaryDailyWork, ["Home", "Intake", "Operations", "Documents", "Coordination", "Reports"]);
assert.equal(contract.lifecycleQuestions.length, 6);
assert.ok(contract.protectedBehaviors.includes("no_module_deletion"));
assert.ok(contract.protectedBehaviors.includes("no_completion_claim_without_discoverable_executable_ui"));
assert.ok(contract.implementationCandidates.every(({ source, rule }) => source && rule));
assert.equal(contract.implementationCandidates.find(({ id }) => id === "GAP-ALL-TOOLS")?.state, "confirmed");

console.log(`REVISION2_R04=PASS requirements=${contract.requirements.length} lifecycleQuestions=${contract.lifecycleQuestions.length} confirmedAllToolsGap=true`);
