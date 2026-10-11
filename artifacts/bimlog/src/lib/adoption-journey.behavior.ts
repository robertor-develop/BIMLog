import assert from "node:assert/strict";
import { ACTIVATION_MILESTONE, ADOPTION_JOURNEY, EMAIL_VERIFICATION_POLICY, PRODUCT_TERMS, adoptionStageLabel } from "./adoption-journey";

assert.deepEqual(ADOPTION_JOURNEY.map(stage => stage.id), ["account", "verify", "company", "project", "control", "first_value"]);
assert.equal(new Set(ADOPTION_JOURNEY.map(stage => stage.completion)).size, ADOPTION_JOURNEY.length);
assert.equal(EMAIL_VERIFICATION_POLICY.requiredBeforeProjectSetup, true);
assert.equal(ACTIVATION_MILESTONE.id, "first_controlled_record");
assert.equal(adoptionStageLabel("first_value", "es"), "Crear el primer registro controlado del proyecto");
for (const term of Object.values(PRODUCT_TERMS)) {
  assert.ok(term.en.trim());
  assert.ok(term.es.trim());
}
console.log("Simplification and guided adoption build 001 canonical journey: PASS");
