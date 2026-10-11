import assert from "node:assert/strict";
import fs from "node:fs";

const read=path=>fs.readFileSync(path,"utf8");
const dashboard=read("artifacts/bimlog/src/pages/Dashboard.tsx"),hook=read("artifacts/bimlog/src/components/OnboardingFlow.tsx"),route=read("artifacts/api-server/src/routes/onboarding.ts"),card=read("artifacts/bimlog/src/components/dashboard/FirstValueSuccessCard.tsx");
for(const token of ["firstValueEvidenceDestination","FirstValueSuccessCard","first_value_seen","acknowledgeFirstValue"]) assert.ok(dashboard.includes(token)||hook.includes(token)||route.includes(token),token);
for(const token of ["first-value-success > button:focus-visible","@media (max-width: 720px)","grid-column:1 / -1","text-overflow:ellipsis"]) assert.ok(dashboard.includes(token),token);
for(const token of ["aria-labelledby","FIRST RESULT ACHIEVED","PRIMER RESULTADO LOGRADO"]) assert.ok(card.includes(token),token);
assert.ok(route.includes("FIRST_VALUE_EVIDENCE_REQUIRED"));
console.log("Simplification and guided adoption Block 5 acceptance: PASS");
