import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ledger = JSON.parse(fs.readFileSync(path.join(root, "contracts/requirement-evidence-ledger.json"), "utf8"));
const expected = [
  ...Array.from({ length: 10 }, (_, index) => `I${String(index + 1).padStart(3, "0")}`),
  ...Array.from({ length: 120 }, (_, index) => `C${String(index + 1).padStart(3, "0")}`),
];
const entries = Object.values(ledger.layers).flat();
assert.equal(ledger.schemaVersion, "bimlog-requirement-evidence-ledger-v1");
assert.equal(entries.length, 130);
assert.equal(new Set(entries).size, 130, "each identity must occur exactly once");
assert.deepEqual([...entries].sort(), expected.sort());
assert.equal(ledger.layers.accepted.length, 108);
assert.deepEqual(ledger.layers.product, ["I003"]);
assert.equal(ledger.layers.provider.length, 15);
assert.equal(ledger.layers.field.length, 6);
assert.equal(ledger.historicalEvidencePolicy, "preserve_and_reference_never_overwrite");
assert.match(ledger.sourceAuditSha256, /^[0-9a-f]{64}$/);
console.log("BLOCK01_BUILD004=PASS identities=130 accepted=108 product=1 provider=15 field=6 duplicates=0");
