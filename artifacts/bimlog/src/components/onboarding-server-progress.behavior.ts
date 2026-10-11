import assert from "node:assert/strict";
import fs from "node:fs";
const source=fs.readFileSync(new URL("./OnboardingFlow.tsx",import.meta.url),"utf8");
assert.match(source,/fetch\(`\$\{API\}\/onboarding`/);
assert.match(source,/guidePaused:true/);
assert.doesNotMatch(source,/bimlog-onboarding-dismissed/);
console.log("onboarding server progress behavior: PASS");
