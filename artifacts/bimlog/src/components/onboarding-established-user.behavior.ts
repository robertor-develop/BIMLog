import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./OnboardingFlow.tsx", import.meta.url), "utf8");

assert.match(
  source,
  /if\(data\.completedAt\|\|data\.projectCount>0\)\{localStorage\.setItem\(STORAGE_KEY,"1"\);onDone\(\);\}/,
  "established users with project access must not be forced through email verification on each new device",
);

assert.match(source, /if\(!state&&!error\)return/, "new users must retain the onboarding flow");

console.log("Established-user onboarding bypass: PASS");
