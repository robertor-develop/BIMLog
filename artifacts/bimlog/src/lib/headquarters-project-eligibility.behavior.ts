import assert from "node:assert/strict";
import { isHeadquartersRecommendationEligible, recommendationEligibleProjects } from "./headquarters-project-eligibility";

const rows = [
  { id: 64, code: "GAUNTLET", status: "active", workspaceGroup: "active" },
  { id: 65, code: "TESTING", status: "testing", workspaceGroup: "testing" },
  { id: 66, code: "QA-P24-0915", status: "archived", workspaceGroup: "retired" },
  { id: 67, code: "INACTIVE", status: "inactive", workspaceGroup: "active" },
];

assert.deepEqual(recommendationEligibleProjects(rows).map(row => row.code), ["GAUNTLET", "TESTING"]);
assert.equal(isHeadquartersRecommendationEligible({ id: 66, status: "active", workspaceGroup: "retired" }), false);
assert.equal(isHeadquartersRecommendationEligible({ id: 0, status: "active", workspaceGroup: "active" }), false);
console.log("B27 Headquarters recommendation eligibility: PASS retired and inactive projects remain outside live actions");
