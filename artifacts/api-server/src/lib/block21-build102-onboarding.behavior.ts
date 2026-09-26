import assert from "node:assert/strict";
import { readBimlogSource } from "./block21-source-reader.js";
// Execute the real browser helper at test runtime without pulling browser sources
// (and their DOM types) into the API server's production TypeScript compilation.
const { distinctInvitationRoles } = await import(new URL("../../../bimlog/src/lib/invitation-ui.ts", import.meta.url).href);

const register = readBimlogSource("pages/Register.tsx");
const onboarding = readBimlogSource("components/OnboardingFlow.tsx");
const team = readBimlogSource("pages/project/TeamTab.tsx");
assert.deepEqual(distinctInvitationRoles([{value:"read_only"},{value:"read_only"},{value:"project_admin"},{value:""}]),[{value:"read_only"},{value:"project_admin"}]);
assert.deepEqual(distinctInvitationRoles([]),[]);
assert.match(team, /distinctInvitationRoles\(getOptions\("member_role"\)\)/);
assert.match(team, /\[invRole, setInvRole\] = useState\(""\)/);
assert.match(team, /\[role, setRole\] = useState\(""\)/);
assert.match(team, /!roleOptions.some\(option => option.value === invRole\)/);
assert.match(team, /!roleOptions.some\(option => option.value === role\)/);

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
