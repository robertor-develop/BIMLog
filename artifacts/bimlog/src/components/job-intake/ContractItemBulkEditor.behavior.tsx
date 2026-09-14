import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ContractItemBulkEditor,
  parseContractItemPaste,
  selectSavedApuVersion,
} from "./ContractItemBulkEditor";

const range = Array.from(
  { length: 125 },
  (_, index) => `Contract Item ${index + 1}\t${index + 1}`,
).join("\r\n");
const rows = parseContractItemPaste(range);
assert.equal(rows.length, 125);
assert.deepEqual(rows[0], {
  sourceRow: 1,
  name: "Contract Item 1",
  quantity: "1",
});
assert.deepEqual(rows[124], {
  sourceRow: 125,
  name: "Contract Item 125",
  quantity: "125",
});
assert.deepEqual(parseContractItemPaste("Door\t2\n\nFrame\t3.5\n"), [
  { sourceRow: 1, name: "Door", quantity: "2" },
  { sourceRow: 3, name: "Frame", quantity: "3.5" },
]);
assert.deepEqual(
  selectSavedApuVersion(
    [
      { version: 2, sellingPrice: "35.47" },
      { version: 3, sellingPrice: "37.99" },
    ],
    "2",
  ),
  { apuPlanVersion: 2, billingHourlyRate: "35.47" },
);
assert.deepEqual(selectSavedApuVersion([], ""), { apuPlanVersion: null });

const item = {
  id: "CI-1",
  name: "Plumbing",
  plannedHours: "50",
  billingHourlyRate: "35.47",
  unit: "Hours",
  apuPlanVersion: null,
  workflowTemplate: "generic",
  contractId: "PRIMARY",
  budgetSnapshotLineId: "",
  projectCostNodeId: "",
  assumptions: "",
  exclusions: "",
  description: "",
};
const emptyStateMarkup = renderToStaticMarkup(
  <ContractItemBulkEditor
    items={[item]}
    setItems={() => undefined}
    currency="USD"
    defaultRate="35.47"
    defaultApuVersion={null}
    apuVersions={[]}
    defaultWorkflow="generic"
    capabilities={{ costValuePlanner: true, budget: true }}
    contracts={[]}
    defaultContractId="PRIMARY"
    budgetSnapshotId=""
    budgetLines={[]}
    onBudgetSnapshotChange={() => undefined}
    snapshots={[]}
    onOpenCostValuePlanner={() => undefined}
    onOpenProjectBudget={() => undefined}
    tt={(en) => en}
    onError={() => undefined}
    onNotice={() => undefined}
  />,
);
assert.match(emptyStateMarkup, /Saved APU version \(optional\)/);
assert.match(emptyStateMarkup, /No saved APU versions are available yet/);
assert.match(emptyStateMarkup, /Open Cost &amp; Value Planner/);
assert.match(emptyStateMarkup, /Approved budget link \(optional\)/);
assert.match(emptyStateMarkup, /No approved budget snapshots are available yet/);
assert.match(emptyStateMarkup, /Open Project Budget/);
assert.doesNotMatch(emptyStateMarkup, /Select saved APU version/);
assert.doesNotMatch(emptyStateMarkup, /Select version/);

const populatedStateMarkup = renderToStaticMarkup(
  <ContractItemBulkEditor
    items={[item]}
    setItems={() => undefined}
    currency="USD"
    defaultRate="37.99"
    defaultApuVersion={3}
    apuVersions={[{ version: 3, name: "Approved", sellingPrice: "37.99" }]}
    defaultWorkflow="generic"
    capabilities={{ costValuePlanner: true, budget: true }}
    contracts={[]}
    defaultContractId="PRIMARY"
    budgetSnapshotId="snapshot-1"
    budgetLines={[{ id: "line-1", project_code: "PL", project_name: "Plumbing", amount: "100", project_cost_node_id: "node-1" }]}
    onBudgetSnapshotChange={() => undefined}
    snapshots={[{ id: "snapshot-1", budgetVersion: 2, total: "100" }]}
    onOpenCostValuePlanner={() => undefined}
    onOpenProjectBudget={() => undefined}
    tt={(en) => en}
    onError={() => undefined}
    onNotice={() => undefined}
  />,
);
assert.match(populatedStateMarkup, /Select saved APU version/);
assert.match(populatedStateMarkup, /v3 · Approved · 37\.99 USD/);
assert.match(populatedStateMarkup, /v2 · 100/);
assert.match(populatedStateMarkup, /PL · Plumbing · 100/);

console.log("ContractItemBulkEditor.behavior: PASS");
