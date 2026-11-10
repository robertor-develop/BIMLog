import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./help-content.ts", import.meta.url), "utf8");
const helpCenter = fs.readFileSync(new URL("../pages/HelpCenter.tsx", import.meta.url), "utf8");

for (const phrase of [
  "Finish sections with their review confirmation",
  "Use packages and tasks only when separate control helps",
  "wait for the verified version message",
  "Activate Intake before expecting assignment controls",
  "no assignment button is missing",
]) assert.match(source, new RegExp(phrase));

assert.match(helpCenter, /\.hc-hero h1\{color:#fff\}/, "Help Center title stays legible on the dark hero");

console.log(JSON.stringify({ status: "PASS", build: 10, checks: ["contract-confirmation-help", "delivery-confirmation-help", "apu-version-help", "operations-activation-help", "floor-package-help"] }));
