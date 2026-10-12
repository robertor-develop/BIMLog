import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const onboarding = readFileSync(new URL("../components/OnboardingFlow.tsx", import.meta.url), "utf8");
const milestones = readFileSync(new URL("./adoption-milestones.ts", import.meta.url), "utf8");

assert.match(onboarding, /logClientError\("onboarding state load",error\)/);
assert.match(onboarding, /if\(!controller\.signal\.aborted\)/);
assert.doesNotMatch(onboarding, /\.catch\(\(\)=>\{\}\)/);

assert.match(milestones, /if\(!response\.ok\)throw new Error/);
assert.match(milestones, /logClientError\("adoption milestone delivery",error\)/);
assert.doesNotMatch(milestones, /\.catch\(\(\)=>\{\}\)/);

console.log("BIMLog adoption observability regression: PASS");
