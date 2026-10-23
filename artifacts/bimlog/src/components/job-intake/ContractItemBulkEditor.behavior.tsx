import assert from "node:assert/strict";
import "../commercial/ContractProductionAllocationReview.behavior";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ContractItemBulkEditor,
  applyDefaultApuToPastedItems,
  mergePastedContractItems,
  pastedContractItemCount,
  normalizeLocalizedQuantity,
  findCompatibleDefaultApu,
  parseContractItemPaste,
  selectSavedApuVersion,
  updateContractItemQuantity,
  updateAllContractItemQuantities,
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
assert.deepEqual(parseContractItemPaste("Muro;1,5\nPuerta;2,25"), [
  { sourceRow: 1, name: "Muro", quantity: "1.5" },
  { sourceRow: 2, name: "Puerta", quantity: "2.25" },
]);
assert.deepEqual(parseContractItemPaste("Excavation\t1.234,5\nBackfill\t2\u202f500,25"), [
  { sourceRow: 1, name: "Excavation", quantity: "1234.5" },
  { sourceRow: 2, name: "Backfill", quantity: "2500.25" },
]);
assert.equal(normalizeLocalizedQuantity("2\u202f500,25").replace(/^(\d+),(\d{1,6})$/, "$1.$2"), "2500.25");
assert.deepEqual(parseContractItemPaste("Nombre de la Partida\tCantidad\nMuro\t4"), [
  { sourceRow: 2, name: "Muro", quantity: "4" },
]);
assert.deepEqual(parseContractItemPaste("Partida de Contrato\tCant.\nMuro\t4"), [
  { sourceRow: 2, name: "Muro", quantity: "4" },
]);
assert.deepEqual(parseContractItemPaste("Item\tQty\nDoor\t2"), [
  { sourceRow: 2, name: "Door", quantity: "2" },
]);
assert.deepEqual(parseContractItemPaste("\uFEFFName\tQuantity\nDoor\t2"), [
  { sourceRow: 2, name: "Door", quantity: "2" },
]);
assert.deepEqual(parseContractItemPaste("Muro\t4\tUSD"), [
  { sourceRow: 1, name: "Muro", quantity: "4", extraColumns: true },
]);
assert.deepEqual(parseContractItemPaste("=HYPERLINK(\"https://example.invalid\")\t1"), [
  { sourceRow: 1, name: "=HYPERLINK(\"https://example.invalid\")", quantity: "1", unsafeFormula: true },
]);
const pastedItem: Record<string, any> = { id: "CI-pasted", name: "Muro", quantity: "4", plannedHours: "4", provenance: { source: "clipboard" } };
assert.deepEqual(
  mergePastedContractItems<Record<string, any>>(
    [{ id: "CI-starter", name: "", description: "", quantity: "1", plannedHours: "1", provenance: null }],
    [pastedItem],
  ),
  [pastedItem],
);
assert.equal(
  mergePastedContractItems<Record<string, any>>([{ id: "CI-existing", name: "Door", quantity: "1", plannedHours: "1" }], [pastedItem]).length,
  2,
);
assert.equal(
  pastedContractItemCount(
    [{ id: "CI-starter", name: "", description: "", quantity: "1", plannedHours: "1", provenance: null }],
    500,
  ),
  500,
);
assert.equal(pastedContractItemCount([{ id: "CI-existing", name: "Door", quantity: "1", plannedHours: "1" }], 500), 501);
assert.deepEqual(
  applyDefaultApuToPastedItems(
    [{ name: "Muro", quantity: "4", billingHourlyRate: "0", unit: "Hours" }],
    7,
    [{ version: 7, name: "APU publicado", sellingPrice: "100", currency: "USD" }],
  )[0],
  {
    name: "Muro", quantity: "4", billingHourlyRate: "25", unit: "Hours", apuPlanVersion: 7,
    rateSource: {
      kind: "saved_apu_rate", sourceId: "apu-plan-v7", sourceLabel: "APU publicado", unitRate: "25",
      unit: "Hours", currency: "USD", apuPlanVersion: 7, apuFingerprint: null,
      planSellingPrice: "100", rateCalculation: "plan_total_divided_by_contract_quantity",
    },
  },
);
assert.deepEqual(
  selectSavedApuVersion(
    [
      { version: 2, sellingPrice: "35.47" },
      { version: 3, sellingPrice: "37.99" },
    ],
    "2",
    { quantity: "2", billingHourlyRate: "5", unit: "Hours" },
  ),
  {
    apuPlanVersion: 2,
    quantity: "2",
    billingHourlyRate: "17.735",
    unit: "Hours",
    rateSource: {
      kind: "saved_apu_rate", sourceId: "apu-plan-v2", sourceLabel: "APU v2",
      unitRate: "17.735", unit: "Hours", currency: "", apuPlanVersion: 2, apuFingerprint: null,
      planSellingPrice: "35.47", rateCalculation: "plan_total_divided_by_contract_quantity",
    },
  },
);
assert.deepEqual(selectSavedApuVersion([], ""), { apuPlanVersion: null });
assert.equal(findCompatibleDefaultApu([{ version: 3, sellingPrice: "37.99", currency: "USD" }], 4), null);
assert.equal(findCompatibleDefaultApu([{ version: 3, sellingPrice: "37.99", currency: "USD" }], 3)?.version, 3);
assert.equal(updateContractItemQuantity(
  { quantity: "2", billingHourlyRate: "50", unit: "Hours", apuPlanVersion: 3, rateSource: { kind: "saved_apu_rate" } },
  "4",
  [{ version: 3, name: "Approved", sellingPrice: "100", currency: "USD" }],
).billingHourlyRate, "25");
assert.equal(updateContractItemQuantity(
  { quantity: "2", billingHourlyRate: "50", unit: "Hours", apuPlanVersion: 3, rateSource: { kind: "manual_rate" } },
  "4",
  [{ version: 3, name: "Approved", sellingPrice: "100", currency: "USD" }],
).billingHourlyRate, "50");
assert.deepEqual(updateAllContractItemQuantities([
  { id: "linked", quantity: "2", billingHourlyRate: "50", unit: "Hours", apuPlanVersion: 3, rateSource: { kind: "saved_apu_rate" } },
  { id: "manual", quantity: "2", billingHourlyRate: "70", unit: "Hours", apuPlanVersion: 3, rateSource: { kind: "manual_rate" } },
], "5", [{ version: 3, name: "Approved", sellingPrice: "100", currency: "USD" }]).map(({ quantity, billingHourlyRate }) => ({ quantity, billingHourlyRate })), [
  { quantity: "5", billingHourlyRate: "20" },
  { quantity: "5", billingHourlyRate: "70" },
]);

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
assert.match(emptyStateMarkup, /Click here, then paste two Excel columns/);
assert.match(emptyStateMarkup, /Paste Excel range/);
assert.match(emptyStateMarkup, /Add pasted rows/);
assert.match(emptyStateMarkup, /disabled=""/);
assert.match(emptyStateMarkup, /value=""/);
assert.doesNotMatch(emptyStateMarkup, /opacity:0/);
assert.match(emptyStateMarkup, /Production allocation row 1/);
assert.match(emptyStateMarkup, /Administration stays separate/);
assert.doesNotMatch(emptyStateMarkup, /Select saved APU version/);
assert.doesNotMatch(emptyStateMarkup, /Select version/);

const populatedStateMarkup = renderToStaticMarkup(
  <ContractItemBulkEditor
    items={[item]}
    setItems={() => undefined}
    currency="USD"
    defaultRate="37.99"
    defaultApuVersion={3}
    apuVersions={[{ version: 3, name: "Approved", sellingPrice: "37.99", currency: "USD" }]}
    defaultWorkflow="generic"
    capabilities={{ costValuePlanner: true, budget: true }}
    contracts={[]}
    defaultContractId="PRIMARY"
    budgetSnapshotId="snapshot-1"
    budgetLines={[{ id: "line-1", project_code: "PL", project_name: "Plumbing", amount: "100", project_cost_node_id: "node-1" }]}
    onBudgetSnapshotChange={() => undefined}
    snapshots={[{ id: "snapshot-1", budget_version: 2, total: "100", currency: "USD" }]}
    onOpenCostValuePlanner={() => undefined}
    onOpenProjectBudget={() => undefined}
    tt={(en) => en}
    onError={() => undefined}
    onNotice={() => undefined}
  />,
);
assert.match(populatedStateMarkup, /Select saved APU version/);
assert.match(populatedStateMarkup, /v3 · Approved · plan total 37\.99 USD/);
assert.match(populatedStateMarkup, /v2 · 100 USD/);
assert.match(populatedStateMarkup, /PL · Plumbing · 100/);

console.log("ContractItemBulkEditor.behavior: PASS");

assert.doesNotMatch(emptyStateMarkup, /APU rate profile/);
