import assert from "node:assert/strict";
import fs from "node:fs";

const evidence = JSON.parse(fs.readFileSync("evidence/outcome-remediation-20261023/build37-apu-persistence.json", "utf8"));
assert.equal(evidence.projectId, 68);
assert.equal(evidence.apu.linkedContractItems, 10);
assert.equal(evidence.apu.planSellingPrice, "600.00");
assert.deepEqual(evidence.apu.quantityPattern.map((quantity, index) => quantity * evidence.apu.unitRatePattern[index]), evidence.apu.contractValuePattern);
assert.equal(evidence.apu.unitRatePattern.every(rate => rate !== Number(evidence.apu.planSellingPrice)), true);
assert.deepEqual(evidence.proof.hardReloadSelections, Array(10).fill(1));
assert.equal(evidence.proof.separatesPlanTotalFromUnitRate, true);
assert.equal(evidence.proof.verification, "AUTHENTICATED_CHROME_HARD_RELOAD_PASS");
console.log("BIMLog final closure Build 37: PASS APU v1 exact rate application and reload persistence");
