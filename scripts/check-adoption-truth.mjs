import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root=process.cwd();
const read=(relative)=>fs.readFileSync(path.join(root,relative),"utf8");
const landing=read("artifacts/bimlog/src/pages/Landing.tsx");
const register=read("artifacts/bimlog/src/pages/Register.tsx");
const onboarding=read("artifacts/bimlog/src/components/OnboardingFlow.tsx");
const availability=read("artifacts/api-server/src/lib/public-commercial-availability.ts");
const offers=read("artifacts/bimlog/src/lib/commercial-offers.ts");

const publicCopy=[landing,read("artifacts/bimlog/src/pages/Pricing.tsx"),read("artifacts/bimlog/src/pages/Features.tsx")].join("\n");
for(const forbidden of [
  /No email confirmation/i,
  /Sin confirmaci[oó]n de correo/i,
  /full access, no limits/i,
  /acceso total, sin l[ií]mites/i,
  /one project for 3 months/i,
  /un proyecto durante 3 meses/i,
]) assert.doesNotMatch(publicCopy,forbidden,`Forbidden adoption promise: ${forbidden}`);

assert.match(landing,/fetchPublicCommercialAvailability/);
assert.match(landing,/availability\.freeOffer\.projectLimit/);
assert.match(landing,/availability\.freeOffer\.memberLimit/);
assert.match(register,/EMAIL_VERIFICATION_POLICY\.reason/);
assert.match(onboarding,/disabled=\{!state\?\.emailVerifiedAt\}/);
assert.match(onboarding,/EMAIL_VERIFICATION_POLICY\.reason/);
assert.match(availability,/emailVerification: "required_before_project_setup"/);
assert.match(availability,/evaluationPeriodDays: null/);
assert.match(availability,/projectLimit: 1/);
assert.match(availability,/memberLimit: 5/);
assert.match(offers,/id:"free"[^\n]+projectLimit:1,memberLimit:5/);

console.log("Adoption truth release check: PASS");
