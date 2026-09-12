import assert from "node:assert/strict";
import fs from "node:fs";

const reports = fs.readFileSync(new URL("../../../bimlog/src/pages/project/ReportsTab.tsx", import.meta.url), "utf8");
const operations = fs.readFileSync(new URL("../../../bimlog/src/pages/JobOperationsWorkspace.tsx", import.meta.url), "utf8");
const contracts = fs.readFileSync(new URL("./financial-contract-export.ts", import.meta.url), "utf8");
const budgets = fs.readFileSync(new URL("./financial-budget-export.ts", import.meta.url), "utf8");

assert.match(reports, /\/api\/v1\/projects\/\$\{projectId\}\/reports\/\$\{selectedReport\.key\}\/pdf/);
assert.match(reports, /downloadGovernedCurrentViewPdf\(projectId, token/);
assert.match(operations, /downloadGovernedCurrentViewPdf\(projectId, token/);
assert.match(operations, /Included sections/);
assert.match(contracts, /Contracts & Commitments — Current View/);
assert.match(contracts, /data\.selectedSections\.includes\("filters"\)/);
assert.match(contracts, /data\.selectedColumns/);
assert.match(contracts, /contentHash/);
assert.match(contracts, /Protected value/);
assert.match(budgets, /Budget current-view export/);
assert.match(budgets, /data\.filters\.map\(safe\)/);
assert.match(budgets, /SHA-256 fingerprint/);
assert.match(budgets, /BIMLog by IgniteSmart/);

console.log("POST-P17 Build 23 governed report and export scope: PASS");
