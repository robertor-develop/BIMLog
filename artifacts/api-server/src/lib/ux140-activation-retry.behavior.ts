import assert from "node:assert/strict";
import { activatedLineageReceipt, canonicalIntakeContractItemSource } from "./job-intake-contract-lineage";

const summary = { contracts: [{ profileId: "base", contractId: "contract-1", contractVersionId: "version-1" }] };
const first = activatedLineageReceipt(summary, "contract-1");
const retry = activatedLineageReceipt(JSON.parse(JSON.stringify(summary)), "contract-1");
assert.deepEqual(retry, first);
assert.deepEqual(first.contractIds, ["contract-1"]);
assert.deepEqual(first.contractVersionIds, ["version-1"]);
assert.equal(canonicalIntakeContractItemSource("intake-1", [{ id: "item-1" }]).fingerprint,
  canonicalIntakeContractItemSource("intake-1", [{ id: "item-1" }]).fingerprint);
console.log("UX140_RESULT=PASS repeated activation returns stable Contract lineage and deterministic Intake-item identity");
