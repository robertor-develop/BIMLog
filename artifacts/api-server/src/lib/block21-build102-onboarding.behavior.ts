import assert from "node:assert/strict";
import { readBimlogSource } from "./block21-source-reader.js";

const register = readBimlogSource("pages/Register.tsx");
const onboarding = readBimlogSource("components/OnboardingFlow.tsx");

assert.match(register, /pending invitation matches this email/);
assert.match(register, /will not create a duplicate company/);
assert.match(onboarding, /if \(!r\.ok\) throw/);
assert.match(onboarding, /We could not load your project access/);
assert.match(onboarding, /does not mistake an invited account for a new workspace/);
assert.match(onboarding, /setLoadAttempt\(value => value \+ 1\)/);
assert.doesNotMatch(onboarding, /\.catch\(\(\) => setFlowType\("new"\)\)/);

console.log("block21 build102 invitation and onboarding recovery: PASS");
