import assert from "node:assert/strict";
import fs from "node:fs";

const evidence = JSON.parse(fs.readFileSync("evidence/outcome-remediation-20261023/build36-controlled-intake.json", "utf8"));
assert.equal(evidence.projectId, 68);
assert.equal(evidence.projectCode, "QA-LOR-FINAL-1023");
assert.equal(evidence.contract.title, "QA Lorena Final Base Contract");
assert.equal(evidence.excelImport.persistedRows, 10);
assert.equal(evidence.excelImport.names.length, 10);
assert.deepEqual(evidence.excelImport.quantities, ["2", "3", "2", "3", "2", "3", "2", "3", "2", "3"]);
assert.equal(evidence.excelImport.canonicalContractBindings, 10);
assert.equal(evidence.verification, "AUTHENTICATED_CHROME_HARD_RELOAD_PASS");
console.log("BIMLog final closure Build 36: PASS controlled Intake and exact imported rows persisted");
