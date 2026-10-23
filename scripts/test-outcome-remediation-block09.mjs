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
assert.equal(focused.status, 0, "Contract Item paste behavior failed");
for (const token of ["localizedQuantity", "contract item name", "unsafeFormula", "pastedContractItemCount", "Add pasted rows", "Agregar filas pegadas"]) {
  assert.ok(editor.includes(token), `missing Block 9 runtime token: ${token}`);
}
for (const token of ["1.234,5", "Partida de Contrato", "HYPERLINK", "500", "Add pasted rows"]) {
  assert.ok(behavior.includes(token), `missing Block 9 acceptance token: ${token}`);
}
console.log("OUTCOME_REMEDIATION_BLOCK09=PASS builds=41-45 groupedQuantities=true commonHeaders=true formulaSafety=true exactLimit=true explicitApply=true");
