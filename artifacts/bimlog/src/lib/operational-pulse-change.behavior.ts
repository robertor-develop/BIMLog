import assert from "node:assert/strict";
import { operationalPulseChange } from "./operational-pulse-change";

assert.deepEqual(
  operationalPulseChange(
    { openRfis: 13, pendingSubmittals: 3, filesNeedingAttention: 14 },
    { openRfis: 11, pendingSubmittals: 4, filesNeedingAttention: 10 },
  ),
  {
    total: -5, rfis: -2, submittals: 1, files: -4, direction: "decreased",
    queues: [
      { key: "rfis", previous: 13, current: 11, delta: -2, direction: "decreased" },
      { key: "submittals", previous: 3, current: 4, delta: 1, direction: "increased" },
      { key: "files", previous: 14, current: 10, delta: -4, direction: "decreased" },
    ],
    largestMovement: { key: "files", previous: 14, current: 10, delta: -4, direction: "decreased" },
  },
);
assert.equal(operationalPulseChange(
  { openRfis: 1, pendingSubmittals: 1, filesNeedingAttention: 1 },
  { openRfis: 1, pendingSubmittals: 1, filesNeedingAttention: 1 },
).direction, "unchanged");
assert.equal(operationalPulseChange(
  { openRfis: 1, pendingSubmittals: 1, filesNeedingAttention: 1 },
  { openRfis: 1, pendingSubmittals: 1, filesNeedingAttention: 1 },
).largestMovement, null);
assert.equal(operationalPulseChange(
  { openRfis: 1, pendingSubmittals: 1, filesNeedingAttention: 1 },
  { openRfis: 2, pendingSubmittals: 2, filesNeedingAttention: 1 },
).largestMovement?.key, "rfis");
assert.equal(operationalPulseChange(
  { openRfis: Number.NaN, pendingSubmittals: -2, filesNeedingAttention: 0 },
  { openRfis: 2.9, pendingSubmittals: 0, filesNeedingAttention: 1 },
).total, 3);

console.log("Operational pulse movement behavior: PASS");
