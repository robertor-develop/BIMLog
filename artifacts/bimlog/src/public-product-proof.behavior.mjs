import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const features = readFileSync(new URL("./pages/Features.tsx", import.meta.url), "utf8");
const claims = [
  "Create BIMLog issues from the active Navisworks model context",
  "Open Working View restores the BIMLog camera without creating a Saved Viewpoint",
  "Export current-project BIMLog viewpoints to Navisworks XML",
  "Link existing same-project RFIs and Submittals to a viewpoint",
  "Attach PDF, JPG, JPEG, or PNG references up to 5 MB",
  "Project and model identity checks prevent cross-project contamination",
];

assert.ok(features.includes('heading: "Navisworks Lens Next"'));
for (const claim of claims) {
  assert.ok(features.includes(claim), claim);
  const occurrences = features.split(claim).length - 1;
  assert.equal(occurrences, 2, `${claim} must have English source and Spanish translation entry`);
  console.log(`PASS ${claim}`);
}
assert.doesNotMatch(features, /BUILD25E|BUILD26A|diagnostic probe/i);
console.log("PASS no internal diagnostic controls are marketed");
console.log(`SUMMARY ${claims.length + 1}/${claims.length + 1} PASS`);
