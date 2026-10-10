import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const tsx = "artifacts/api-server/node_modules/tsx/dist/cli.mjs";
for (const file of [
  "artifacts/bimlog/src/lib/commercial-availability-journey.behavior.ts",
  "artifacts/bimlog/src/pages/commercial-registration-continuity.behavior.ts",
  "artifacts/bimlog/src/components/commercial-onboarding-continuity.behavior.ts",
  "artifacts/bimlog/src/pages/contact-sales-inquiry.behavior.ts",
]) {
  const result = spawnSync(process.execPath, [tsx, file], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  process.stdout.write(result.stdout);
}

const pricing = fs.readFileSync("artifacts/bimlog/src/pages/Pricing.tsx", "utf8");
for (const token of [
  "commercialAvailabilityJourney",
  "availabilityFailed?null:availability",
  "action.detail[lang]",
  "action.destination",
  "action.label[lang]",
]) assert.ok(pricing.includes(token), token);
assert.ok(!pricing.includes("href={commercialDestination(offer,billing,useCase)}"));
console.log("LR020 Pricing-to-registration-or-consultation acceptance: PASS");
