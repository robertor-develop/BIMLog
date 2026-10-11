import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(path,"utf8");
const progress=read("artifacts/bimlog/src/lib/adoption-progress.ts");
const route=read("artifacts/api-server/src/routes/onboarding.ts");
const card=read("artifacts/bimlog/src/components/dashboard/SetupProgressCard.tsx");
const dashboard=read("artifacts/bimlog/src/pages/Dashboard.tsx");
const flow=read("artifacts/bimlog/src/components/OnboardingFlow.tsx");

assert.match(progress,/nextStage: AdoptionStageId \| null/);
assert.match(route,/guidePaused==="boolean"/);
assert.match(route,/guide_paused' ELSE '' END/);
assert.match(card,/role="progressbar"/);
assert.match(card,/Continuar configuración/);
assert.match(flow,/body:JSON\.stringify\(\{guidePaused:false\}\)/);
assert.match(dashboard,/onboardingState\.completedSteps\.includes\("guide_paused"\)/);
assert.match(dashboard,/@media \(prefers-reduced-motion: reduce\)/);
assert.match(dashboard,/\.setup-progress-card \{ grid-template-columns:auto minmax\(0,1fr\); \}/);
console.log("Simplification and guided adoption Block 3: PASS");
