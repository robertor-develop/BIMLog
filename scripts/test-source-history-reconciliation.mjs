import assert from "node:assert/strict";
import { classifyHistoryPath } from "./source-history-reconciliation.mjs";

assert.deepEqual(classifyHistoryPath("product-default", "living-brief/STATUS.md").disposition, "SUPERSEDE");
assert.deepEqual(classifyHistoryPath("product-default", "docs/lens-next-mockup/a.md").disposition, "EVIDENCE_ONLY");
assert.deepEqual(classifyHistoryPath("product-default", "artifacts/bimlog/src/features/lens-next/LensNextPanel.tsx").mappedBuilds, "066-070");
assert.deepEqual(classifyHistoryPath("next-200", "scripts/pdf-family-inventory.mjs").mappedBuilds, "081-085");
assert.deepEqual(classifyHistoryPath("next-200", "artifacts/api-server/src/routes/feedback.ts").mappedBuilds, "076-080");
console.log("Source history reconciliation behavior: PASS");
