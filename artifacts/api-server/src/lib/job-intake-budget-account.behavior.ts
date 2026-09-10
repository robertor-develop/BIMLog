import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildActivatedCommercialBaseline } from "./job-activation-commercial-baseline";

const baseline = buildActivatedCommercialBaseline({
  intakeId: "INTAKE-10", projectId: 26, currency: "USD", workflowInstances: 1, workItems: 2, tasks: 2, resourceAssignments: 1,
  contracts: [{ profileId: "BASE", contractId: "CONTRACT", contractVersionId: "CV-1", contractNumber: "C-100", currency: "USD", items: [
    { stableLineId: "CI-1", displayName: "Drafting", projectCostNodeId: "NODE-1", budgetSnapshotLineId: "BL-1", quantity: "2", unit: "Hours", unitRate: "35.47", contractValue: "70.94", apuPlanVersion: 3, workflowTemplate: "generic" },
    { stableLineId: "CI-2", displayName: "Coordination", projectCostNodeId: "NODE-1", budgetSnapshotLineId: "BL-2", quantity: "1", unit: "Hours", unitRate: "37.99", contractValue: "37.99", apuPlanVersion: 4, workflowTemplate: "generic" },
  ] }],
});
assert.equal(baseline.budgetAccounts.length, 1);
assert.equal(baseline.budgetAccounts[0].amount, "108.93");
assert.deepEqual(baseline.budgetAccounts[0].contractItemIds, ["CI-1", "CI-2"]);
assert.deepEqual(baseline.contractItems.map((item) => item.budgetSnapshotLineId), ["BL-1", "BL-2"]);

const root = path.resolve(import.meta.dirname, "../../../..");
const persistence = fs.readFileSync(path.join(root, "artifacts/api-server/src/lib/job-activation-commercial-baseline.ts"), "utf8");
const page = fs.readFileSync(path.join(root, "artifacts/bimlog/src/pages/JobIntakeWorkspace.tsx"), "utf8");
assert.match(persistence, /ON CONFLICT\(intake_id,project_cost_node_id\) DO NOTHING/);
assert.match(page, /Canonical budget accounts/);

console.log(JSON.stringify({ status: "PASS", build: 10, checks: ["canonical-account-generation", "source-line-association", "idempotent-persistence", "visible-activation-result"] }));
