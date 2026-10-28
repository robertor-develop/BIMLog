import assert from "node:assert/strict";
import fs from "node:fs";

const ledger = JSON.parse(fs.readFileSync(new URL("../contracts/requirement-evidence-ledger.json", import.meta.url)));
const contract = JSON.parse(fs.readFileSync(new URL("../contracts/revision2-identity-disposition.json", import.meta.url)));

const expected = [
  ...Array.from({ length: 10 }, (_, index) => `I${String(index + 1).padStart(3, "0")}`),
  ...Array.from({ length: 120 }, (_, index) => `C${String(index + 1).padStart(3, "0")}`),
];
const layerEntries = Object.entries(ledger.layers);
const flattened = layerEntries.flatMap(([, identities]) => identities);

assert.equal(contract.identityUniverse.total, 130);
assert.deepEqual([...flattened].sort(), [...expected].sort(), "the corrected audit universe must be exactly I001–I010 and C001–C120");
assert.equal(new Set(flattened).size, 130, "every identity must appear exactly once");

const sourceLayers = Object.values(contract.dispositions).map(({ sourceLayer }) => sourceLayer);
assert.deepEqual([...sourceLayers].sort(), layerEntries.map(([layer]) => layer).sort());
assert.equal(contract.completionRules.acceptedCapabilityRemovalAllowed, false);
assert.equal(contract.completionRules.providerOrFieldEvidenceMayBeConvertedToProductCompletion, false);
assert.equal(contract.dispositions.product_gap.mayGenerateImplementationBuild, true);
for (const key of ["accepted_preserve", "provider_obligation", "field_acceptance"]) {
  assert.equal(contract.dispositions[key].mayGenerateImplementationBuild, false, `${key} cannot inflate the implementation program`);
}

const negative = structuredClone(ledger);
negative.layers.product.push("I001");
assert.notEqual(new Set(Object.values(negative.layers).flat()).size, Object.values(negative.layers).flat().length, "duplicate identity must be rejected");

console.log(`REVISION2_R01=PASS identities=${flattened.length} accepted=${ledger.layers.accepted.length} product=${ledger.layers.product.length} provider=${ledger.layers.provider.length} field=${ledger.layers.field.length}`);
