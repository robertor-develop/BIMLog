import assert from "node:assert/strict";
import { lensIssueFieldAuthorities, uniqueLensResponsibleCompanyOptions } from "./lens-issue-field-authority";

assert.deepEqual(lensIssueFieldAuthorities.map(row => row.field), [
  "trade", "floor", "responsibleCompany", "reportType", "priority", "status", "instruction", "openItems", "auditReason",
]);
assert.equal(lensIssueFieldAuthorities.find(row => row.field === "responsibleCompany")?.scope, "project");
assert.equal(lensIssueFieldAuthorities.find(row => row.field === "status")?.writePermission, "workflow_transition");

const options = uniqueLensResponsibleCompanyOptions([
  { id: 7, label: " Mainline   Pools ", historicalLabel: "Mainline Pools", active: true, projectAuthorized: true, assignable: true, source: "project_directory", unavailabilityReason: null },
  { id: 7, label: "Mainline Pools", historicalLabel: "Mainline Pools", active: true, projectAuthorized: false, assignable: false, source: "historical_issue", unavailabilityReason: "historical_only" },
  { id: null, label: "Legacy Co", historicalLabel: "Legacy Co", active: false, projectAuthorized: false, assignable: false, source: "historical_issue", unavailabilityReason: "historical_only" },
]);
assert.deepEqual(options, [
  { id: null, label: "Legacy Co", historicalLabel: "Legacy Co", active: false, projectAuthorized: false, assignable: false, source: "historical_issue", unavailabilityReason: "historical_only" },
  { id: 7, label: "Mainline Pools", historicalLabel: "Mainline Pools", active: true, projectAuthorized: true, assignable: true, source: "project_directory", unavailabilityReason: null },
]);
assert.ok(!options.some(row => row.label === "Other"), "Lens must not synthesize an Other company");
console.log("Lens Build 001 field authority and project-scoped company catalog: PASS");
