import assert from "node:assert/strict";
import { readBimlogSource } from "./block21-source-reader.js";

const register = readBimlogSource("pages/Register.tsx");
const onboarding = readBimlogSource("components/OnboardingFlow.tsx");

assert.match(register, /readInvitationToken/);
assert.match(register, /auth\/invitations\/preview/);
assert.match(register, /No new company will be created/);
assert.match(register, /company_join/);
assert.match(register, /login#invite=/);
assert.match(register, /addEventListener\("hashchange",changed\)/);
assert.match(register, /removeEventListener\("hashchange",changed\)/);
assert.match(register, /setInviteToken\(next\);setInvitation\(null\)/);
assert.match(onboarding, /if \(!r\.ok\) throw/);
assert.match(onboarding, /We could not load your project access/);
assert.match(onboarding, /does not mistake an invited account for a new workspace/);
assert.match(onboarding, /setLoadAttempt\(value => value \+ 1\)/);
assert.doesNotMatch(onboarding, /\.catch\(\(\) => setFlowType\("new"\)\)/);

console.log("block21 build102 invitation and onboarding recovery: PASS");
