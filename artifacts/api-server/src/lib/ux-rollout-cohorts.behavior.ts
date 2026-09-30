import assert from "node:assert/strict";
import { inferProjectClassificationFromName, prepareRolloutCohort, type ProjectClassification } from "./ux-rollout-cohorts";

const classifications: ProjectClassification[] = [
  { projectId: 58, dataClass: "synthetic", explicitlyClassified: true, classifiedBy: "qa-owner", classifiedAt: "2026-09-30T01:30:00Z", reason: "Reviewed UX audit fixture" },
  { projectId: 26, dataClass: "customer", explicitlyClassified: true, classifiedBy: "project-owner", classifiedAt: "2026-09-30T01:31:00Z", reason: "Reviewed project authority" },
];
const result = prepareRolloutCohort("ux-pilot", classifications, [
  { projectId: 58, cohortId: "ux-pilot", reviewedBy: "qa-owner", reviewedAt: "2026-09-30T01:35:00Z", reason: "Approved synthetic pilot" },
  { projectId: 26, cohortId: "ux-pilot", reviewedBy: "project-owner", reviewedAt: "2026-09-30T01:36:00Z", reason: "Approved bounded customer pilot" },
  { projectId: 99, cohortId: "ux-pilot", reviewedBy: "qa-owner", reviewedAt: "2026-09-30T01:37:00Z", reason: "Awaiting explicit classification" },
]);
assert.deepEqual(result.eligibleProjectIds, [26, 58]);
assert.deepEqual(result.excluded, [{ projectId: 99, reason: "classification_missing" }]);
assert.equal(result.writesPerformed, 0);
assert.throws(() => inferProjectClassificationFromName("RUBENS TEST PROJECT"), /NAME_BASED/);
assert.throws(() => prepareRolloutCohort("ux-pilot", [...classifications, classifications[0]], []), /DUPLICATE/);
console.log("UX095 explicit project metadata and rollout cohort preparation: PASS");
