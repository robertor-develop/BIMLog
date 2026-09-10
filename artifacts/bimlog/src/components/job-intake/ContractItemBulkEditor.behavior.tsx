import assert from "node:assert/strict";
import {
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

console.log("ContractItemBulkEditor.behavior: PASS");
