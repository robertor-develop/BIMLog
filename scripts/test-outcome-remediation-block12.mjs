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
for (const token of ["splitDelimitedContractItemRecords", "detectContractItemDelimiter", "malformedQuoteBoundary", "replace(/^\\uFEFF/", "normalizePastedContractItemName"]) {
  assert.ok(editor.includes(token), `missing Block 12 runtime token: ${token}`);
}
for (const token of ["Door\\nFrame", "Door; Frame", "Door\"x", "\\uFEFF2", "Door Frame"]) {
  assert.ok(behavior.includes(token), `missing Block 12 acceptance token: ${token}`);
}
console.log("OUTCOME_REMEDIATION_BLOCK12=PASS builds=56-60 multiline=true delimiterOutsideQuotes=true quoteBoundary=true quantityBom=true nameWhitespace=true");
