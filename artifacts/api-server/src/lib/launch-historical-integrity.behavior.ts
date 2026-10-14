import assert from "node:assert/strict";
import { inspectLaunchHistoricalIntegrity } from "./launch-historical-integrity";

const result = inspectLaunchHistoricalIntegrity();
assert.equal(result.classification, "HISTORICAL_INTEGRITY_DECLARED");
assert.equal(result.prospectiveSettingsOnly, true);
assert.equal(result.items.length, 6);
assert.equal(new Set(result.items.map(item => item.artifact)).size, result.items.length);
assert.ok(result.items.every(item => item.evidence.length > 8));
assert.deepEqual(result.items.find(item => item.artifact === "invoices"), {
  artifact: "invoices",
  status: "protected",
  rule: "issued_snapshot_immutable",
  evidence: "commercial-invoice-party-snapshot",
});
assert.equal(result.items.find(item => item.artifact === "contracts")?.status, "configuration_only");
assert.equal(result.items.find(item => item.artifact === "exports_and_final_reports")?.rule, "prospective_configuration");

console.log("PASS launch historical integrity registry (8 checks)");
