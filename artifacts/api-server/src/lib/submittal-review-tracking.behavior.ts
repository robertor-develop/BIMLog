import assert from "node:assert/strict";
import { submittalReviewTracking } from "./submittal-review-tracking";

const requirements = [
  { id: "REQ-1", projectId: 8, number: "03 30 00", title: "Concrete mix", requiredAt: "2026-09-20T17:00:00Z", reviewerCompany: "BIMTECH CORP" },
  { id: "REQ-2", projectId: 8, number: "23 31 00", title: "Ductwork", requiredAt: "2026-10-10T17:00:00Z", reviewerCompany: "Engineer LLC" },
];
const packages = [
  { id: 101, projectId: 8, requirementId: "REQ-1", number: "SUB-1", title: "Mix rev 0", revisionNumber: 0, submittedAt: "2026-09-18T12:00:00Z", reviewedAt: null, reviewerCompany: "BIMTECH CORP" },
  { id: 102, projectId: 8, requirementId: "REQ-1", number: "SUB-1", title: "Mix rev 1", revisionNumber: 1, submittedAt: "2026-09-21T12:00:00Z", reviewedAt: "2026-09-22T12:00:00Z", reviewerCompany: "BIMTECH CORP" },
  { id: 102, projectId: 8, requirementId: "REQ-1", number: "SUB-1", title: "duplicate join row", revisionNumber: 1, submittedAt: "2026-09-21T12:00:00Z", reviewedAt: "2026-09-22T12:00:00Z", reviewerCompany: "BIMTECH CORP" },
  { id: 103, projectId: 8, requirementId: null, number: "SUB-X", title: "Unplanned sample", revisionNumber: 0, submittedAt: "2026-09-23T12:00:00Z", reviewedAt: null, reviewerCompany: "BIMTECH CORP" },
];

const rows = submittalReviewTracking({ projectId: 8, now: "2026-09-28T12:00:00Z", requirements, packages });
assert.equal(rows.length, 3, "planned requirements and an unmatched package remain independently visible");
assert.deepEqual(rows.find(row => row.requirementId === "REQ-1")?.packageIds, [101, 102], "duplicate joins do not multiply packages");
assert.equal(rows.find(row => row.requirementId === "REQ-1")?.state, "reviewed");
assert.equal(rows.find(row => row.requirementId === "REQ-2")?.state, "required");
assert.equal(rows.find(row => row.identity === "unmatched-package:103")?.state, "received");

const filtered = submittalReviewTracking({ projectId: 8, now: "2026-09-28T12:00:00Z", requirements, packages, reviewerCompany: "bimtech corp" });
assert.deepEqual(filtered.map(row => row.identity), ["requirement:REQ-1", "unmatched-package:103"]);

const overdue = submittalReviewTracking({ projectId: 8, now: "2026-09-28T12:00:00Z", requirements: [{ ...requirements[0]!, id: "REQ-LATE" }], packages: [] });
assert.equal(overdue[0]?.state, "overdue");

console.log("C034 Submittal review tracking: PASS");
