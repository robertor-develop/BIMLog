import assert from "node:assert/strict";
import fs from "node:fs";
import { classifyHistoryPath } from "./source-history-reconciliation.mjs";

assert.deepEqual(classifyHistoryPath("product-default", "living-brief/STATUS.md").disposition, "SUPERSEDE");
assert.deepEqual(classifyHistoryPath("product-default", "docs/lens-next-mockup/a.md").disposition, "EVIDENCE_ONLY");
assert.deepEqual(classifyHistoryPath("product-default", "artifacts/bimlog/src/features/lens-next/LensNextPanel.tsx").mappedBuilds, "066-070");
assert.deepEqual(classifyHistoryPath("next-200", "scripts/pdf-family-inventory.mjs").mappedBuilds, "081-085");
assert.deepEqual(classifyHistoryPath("next-200", "artifacts/api-server/src/routes/feedback.ts").mappedBuilds, "076-080");

const reconciliation = JSON.parse(fs.readFileSync("evidence/stabilization-program-20260919/SOURCE_HISTORY_RECONCILIATION.json", "utf8"));
assert.equal(reconciliation.candidates.length, 2);
for (const candidate of reconciliation.candidates) {
  assert.equal(candidate.candidateOnly, candidate.subjects.length);
  assert.equal(candidate.files.length, new Set(candidate.files.map((item) => item.file)).size);
  assert.equal(candidate.files.length, Object.values(candidate.counts).reduce((sum, count) => sum + count, 0));
  assert.equal(candidate.wholesaleIntegrationAllowed, false);
  assert.ok(candidate.files.every((item) => item.disposition && item.reason));
}

console.log(`Source history reconciliation behavior: PASS candidates=${reconciliation.candidates.length}`);
