import assert from "node:assert/strict";
import { classifyResponsibility } from "./responsibility-classification";
import type { ResponsibilityWorkspaceItem } from "./responsibility-workspace";

const base: ResponsibilityWorkspaceItem = {
  key: "10:rfi:7", sourceIdentity: { module: "rfi", recordId: 7 }, project: { id: 10, name: "P", code: "P" },
  title: "Review", status: "in_review", owner: { userId: 2, person: "Reviewer", company: "BIMTECH" },
  deadline: "2026-09-27T23:00:00-04:00", sourceUpdatedAt: "2026-09-20T23:30:00-04:00",
  authorizedLink: "/projects/10/rfis/7", contextGaps: [], lensEvidence: null,
};
const result = classifyResponsibility(base, new Date("2026-09-29T01:00:00Z"));
assert.equal(result.groups.due, false, "deadline normalizes to its UTC date");
assert.equal(result.groups.overdue, true);
assert.equal(result.groups.noResponse, true);
assert.equal(result.metrics.recordAgeDays, 8);
assert.equal(result.metrics.deadlineDaysLate, 1);
assert.equal(result.metrics.reviewerDelayDays, 8);

const blocked = classifyResponsibility({ ...base, status: "blocked", deadline: "2026-09-20", sourceUpdatedAt: "2026-09-01" }, new Date("2026-09-29T12:00:00Z"));
assert.equal(blocked.groups.blocked, true);
assert.equal(blocked.groups.overdue, true);
assert.equal(blocked.groups.noResponse, false, "record age is not reviewer delay outside review/waiting states");
assert.equal(blocked.metrics.deadlineDaysLate, 9);
assert.equal(blocked.metrics.recordAgeDays, 28);
assert.equal(blocked.metrics.reviewerDelayDays, null);
console.log("C028 responsibility classification: PASS");
