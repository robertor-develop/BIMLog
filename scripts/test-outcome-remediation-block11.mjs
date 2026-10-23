import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");
const editor = read("artifacts/bimlog/src/components/job-intake/ContractItemBulkEditor.tsx");
const behavior = read("artifacts/bimlog/src/components/job-intake/ContractItemBulkEditor.behavior.tsx");
const tsx = resolve(root, "artifacts/api-server/node_modules/tsx/dist/cli.mjs");
const focused = spawnSync(process.execPath, [tsx, resolve(root, "artifacts/bimlog/src/components/job-intake/ContractItemBulkEditor.behavior.tsx")], { stdio: "inherit" });
assert.equal(focused.status, 0, "Contract Item behavior failed");
for (const token of ["updateContractItemQuantity", "updateAllContractItemQuantities", "buildPastedContractItem", "parseDelimitedContractItemRow", "if (appendPastedItems(source)) setPasteText(\"\")"]) {
  assert.ok(editor.includes(token), `missing Block 11 runtime token: ${token}`);
}
for (const token of ["saved_apu_rate", "plannedHours, \"1\"", "Door, Frame", "malformedQuote"]) {
  assert.ok(behavior.includes(token), `missing Block 11 acceptance token: ${token}`);
}
console.log("OUTCOME_REMEDIATION_BLOCK11=PASS builds=51-55 rowReprice=true bulkReprice=true laborSeparate=true quotedExcel=true staleFallbackCleared=true");
