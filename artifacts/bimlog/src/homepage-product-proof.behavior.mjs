import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const landing = readFileSync(new URL("./pages/Landing.tsx", import.meta.url), "utf8");

const verifiedClaims = [
  "Create an authoritative BIMLog viewpoint from the active Navisworks model context.",
  "Link same-project RFIs, Submittals, and bounded reference attachments without changing the camera.",
  "Open Working View restores the BIMLog camera, while XML export supports one-way Navisworks interoperability.",
];

assert.ok(landing.includes('aria-labelledby="verified-workflow-title"'), "verified workflow has an accessible section heading");
assert.ok(landing.includes('href="/features"'), "homepage links to detailed capability proof");
assert.ok(landing.includes("not a concept screen or customer testimonial"), "homepage labels the evidence boundary honestly");
for (const claim of verifiedClaims) {
  assert.ok(landing.includes(claim), claim);
}
assert.doesNotMatch(landing, /trusted by|customers? love|five[- ]star|customer quote|customer success story/i, "homepage contains no invented social proof");
assert.doesNotMatch(landing, /BUILD25E|BUILD26A|diagnostic probe/i, "homepage contains no internal diagnostics");
console.log(`SUMMARY ${verifiedClaims.length + 5}/${verifiedClaims.length + 5} PASS`);
