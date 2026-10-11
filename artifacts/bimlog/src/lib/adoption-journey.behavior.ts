import assert from "node:assert/strict";
import { ACTIVATION_MILESTONE, ADOPTION_JOURNEY, EMAIL_VERIFICATION_POLICY, PRODUCT_TERMS, adoptionStageLabel } from "./adoption-journey";
import { readFileSync } from "node:fs";

assert.deepEqual(ADOPTION_JOURNEY.map(stage => stage.id), ["account", "verify", "company", "project", "control", "first_value"]);
assert.equal(new Set(ADOPTION_JOURNEY.map(stage => stage.completion)).size, ADOPTION_JOURNEY.length);
assert.equal(EMAIL_VERIFICATION_POLICY.requiredBeforeProjectSetup, true);
assert.equal(ACTIVATION_MILESTONE.id, "first_controlled_record");
assert.equal(adoptionStageLabel("first_value", "es"), "Crear el primer registro controlado del proyecto");
for (const term of Object.values(PRODUCT_TERMS)) {
  assert.ok(term.en.trim());
  assert.ok(term.es.trim());
}
const landing = readFileSync(new URL("../pages/Landing.tsx", import.meta.url), "utf8");
const register = readFileSync(new URL("../pages/Register.tsx", import.meta.url), "utf8");
const onboarding = readFileSync(new URL("../components/OnboardingFlow.tsx", import.meta.url), "utf8");
assert.doesNotMatch(landing, /No email confirmation|Sin confirmación de correo/);
assert.match(landing, /EMAIL_VERIFICATION_POLICY\.reason/);
assert.match(register, /EMAIL_VERIFICATION_POLICY\.reason/);
assert.match(onboarding, /EMAIL_VERIFICATION_POLICY\.reason/);
assert.doesNotMatch(landing, /3 months|3 meses|full access, no limits|acceso total, sin límites/);
assert.match(landing, /fetchPublicCommercialAvailability/);
console.log("Simplification and guided adoption build 001 canonical journey: PASS");
