import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./help-content.ts", import.meta.url), "utf8");

for (const phrase of [
  "Finish sections with their review confirmation",
  "Use work packages only when separate control helps",
  "wait for the verified version message",
  "Activate Intake before expecting assignment controls",
  "no assignment button is missing",
]) assert.match(source, new RegExp(phrase));

console.log(JSON.stringify({ status: "PASS", build: 10, checks: ["contract-confirmation-help", "delivery-confirmation-help", "apu-version-help", "operations-activation-help", "floor-package-help"] }));
