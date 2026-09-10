import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { normalizeJobIntakeData } from "./job-intake-contract";

const original = normalizeJobIntakeData({
  identity: { currency: "USD" },
  commercial: { contracts: [{ id: "BASE", category: "base_contract" }] },
  scopeItems: [{ id: "CI-1", name: "Coordination", plannedHours: "8", billingHourlyRate: "37.99", apuPlanVersion: 7, contractId: "BASE" }],
});
const reloaded = normalizeJobIntakeData(JSON.parse(JSON.stringify(original)));
assert.equal(reloaded.scopeItems[0].apuPlanVersion, 7);
assert.equal(reloaded.scopeItems[0].billingHourlyRate, "37.99");
assert.equal(reloaded.scopeItems[0].contractId, "BASE");

const root = path.resolve(import.meta.dirname, "../../../..");
const page = fs.readFileSync(path.join(root, "artifacts/bimlog/src/components/job-intake/ContractItemBulkEditor.tsx"), "utf8");
assert.match(page, /Saved binding: APU v/);
assert.match(page, /Vínculo guardado: APU v/);

console.log(JSON.stringify({ status: "PASS", build: 7, checks: ["apu-version-roundtrip", "apu-rate-roundtrip", "contract-binding-roundtrip", "visible-saved-binding"] }));
