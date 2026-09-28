import assert from "node:assert/strict";
import { reviewerStepTracking } from "./reviewer-step-tracking";
import type { ReviewerCustodyStep } from "./reviewer-custody-history";

const calendar = { version: "BIMTECH-1", timeZone: "UTC", workingWeekdays: [1, 2, 3, 4, 5], workdayStart: "09:00", workdayEnd: "17:00", holidays: [] };
const step = (identity: string, party: string, openedAt: string, closedAt: string | null): ReviewerCustodyStep => ({
  identity,
  source: "rfi_custody",
  recordType: "rfi",
  recordId: 7,
  projectId: 3,
  sourceEventId: identity,
  party,
  company: "BIMTECH CORP",
  openedAt,
  closedAt,
  intervalState: closedAt ? "closed" : "open",
  provenance: { tableOrField: "rfi_ball_in_court_history", rawDaysHeld: null },
});

const reopened = reviewerStepTracking({
  recordCreatedAt: "2026-09-21T09:00:00Z",
  now: "2026-09-25T17:00:00Z",
  calendar,
  sequence: "sequential",
  steps: [
    step("1", "Trade", "2026-09-21T09:00:00Z", "2026-09-21T17:00:00Z"),
    step("2", "Architect", "2026-09-22T09:00:00Z", "2026-09-22T17:00:00Z"),
    step("3", "Trade", "2026-09-25T09:00:00Z", null),
  ],
});
assert.equal(reopened.steps[2]?.returned, true, "reassignment back to a prior party is retained as a new returned step");
assert.equal(reopened.currentStepBusinessMinutes, 480);
assert.equal(reopened.totalRecordAgeBusinessMinutes, 2400);
assert.notEqual(reopened.currentStepBusinessMinutes, reopened.totalRecordAgeBusinessMinutes);

const parallel = reviewerStepTracking({
  recordCreatedAt: "2026-09-25T09:00:00Z",
  now: "2026-09-25T12:00:00Z",
  calendar,
  sequence: "parallel",
  steps: [step("a", "Architect", "2026-09-25T09:00:00Z", null), step("b", "Engineer", "2026-09-25T10:00:00Z", null)],
});
assert.equal(parallel.sequence, "parallel");
assert.equal(parallel.currentStepBusinessMinutes, null, "parallel reviewers retain separate clocks");
assert.deepEqual(parallel.parallelPendingBusinessMinutes.map(item => item.minutes), [180, 120]);

console.log("C033 reviewer-step tracking and honest clocks: PASS");
