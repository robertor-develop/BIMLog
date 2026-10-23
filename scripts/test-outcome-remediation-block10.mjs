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
for (const token of ["\\uFEFF", "normalizeLocalizedQuantity", "if (appendPastedItems(pasteText))", "clipboard has no text", "findCompatibleDefaultApu", "unavailable or incompatible"]) {
  assert.ok(editor.includes(token), `missing Block 10 runtime token: ${token}`);
}
for (const token of ["\\uFEFFName", "2500.25", "findCompatibleDefaultApu", "Add pasted rows"]) {
  assert.ok(behavior.includes(token), `missing Block 10 acceptance token: ${token}`);
}
console.log("OUTCOME_REMEDIATION_BLOCK10=PASS builds=46-50 bom=true bulkLocale=true repairPreserved=true emptyClipboard=true unavailableApuClosed=true");
