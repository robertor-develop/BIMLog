import assert from "node:assert/strict";
import { verifyGoldenJourney } from "./ux-golden-journey";

const names = ["setup", "activate", "task", "evidence", "decision", "report"] as const;
const valid = names.map((name, index) => ({ name, expectedRecordId: `record-${index}`, observedRecordId: `record-${index}`, mutationCount: 1 }));
assert.deepEqual(verifyGoldenJourney(valid), { status: "passed", failures: [], exactRecordChain: true });
assert.equal(verifyGoldenJourney(valid.map((step, index) => index === 3 ? { ...step, observedRecordId: "wrong" } : step)).status, "blocked");
assert.equal(verifyGoldenJourney(valid.map((step, index) => index === 2 ? { ...step, mutationCount: 2 } : step)).status, "blocked");
assert.equal(verifyGoldenJourney(valid.slice(0, 5)).status, "blocked");
console.log("UX096 transactional golden journey: PASS");
