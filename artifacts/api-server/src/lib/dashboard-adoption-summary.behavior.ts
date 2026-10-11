import assert from "node:assert/strict";
import { boundedDashboardAdoptionSummary } from "./dashboard-adoption-summary";

const summary = boundedDashboardAdoptionSummary({
  attention: Array.from({ length: 24 }, (_, index) => ({ kind: "rfi" as const, projectId: index + 1, projectCode: `P${index + 1}`, projectName: `Project ${index + 1}`, count: 1 })),
  assigned: [
    { kind: "rfi", projectId: 7, number: "RFI-7", title: "Review opening" },
    { kind: "submittal", projectId: 8, number: "SUB-8", title: "Review package" },
    { kind: "rfi", projectId: 9, number: "RFI-9", title: "Must be capped" },
  ],
  recentActivity: Array.from({ length: 19 }, (_, index) => ({ id: index + 1, projectId: 7, projectName: "Seven", userEmail: null, userFullName: "User", userCompanyName: null, actionType: "update", entityType: "rfi", details: null, createdAt: new Date(0) })),
  namingCompanies: [{ company: "BIMTECH", count: 3, projectIds: [7, 7, 8, -1] }],
});

assert.equal(summary.attention.length, 20);
assert.deepEqual(summary.assigned.map(item => item.kind), ["rfi", "submittal"]);
assert.equal(summary.recentActivity.length, 15);
assert.deepEqual(summary.namingCompanies[0].projectIds, [7, 8]);
console.log("Simplification and guided adoption build 026 bounded Headquarters adoption contract: PASS");
