import assert from "node:assert/strict";
import fs from "node:fs";
import { runTsGate } from "./lib/observable-gate-runner.mjs";

const connection = fs.readFileSync("artifacts/bimlog/src/lib/job-intake-apu-connection.ts", "utf8");
const editor = fs.readFileSync("artifacts/bimlog/src/components/job-intake/ContractItemBulkEditor.tsx", "utf8");
const contract = fs.readFileSync("artifacts/api-server/src/lib/job-intake-contract.ts", "utf8");
const financialApu = [
  fs.readFileSync("artifacts/api-server/src/lib/financial-contract-apu-binding.ts", "utf8"),
  fs.readFileSync("artifacts/api-server/src/lib/financial-contract-service.ts", "utf8"),
].join("\n");

for (const required of [
  "published_unit_rate",
  "plan_total_divided_by_contract_quantity",
  "apuFingerprint",
  "apuPlanVersion: apu.version",
]) assert.ok(connection.includes(required), `missing exact saved-APU rate authority: ${required}`);

for (const required of [
  "selectSavedApuVersion",
  "Saved APU version (optional)",
  "Saved binding: APU v",
  "Saved version unavailable or incompatible",
]) assert.ok(editor.includes(required), `missing selectable and visible saved-APU behavior: ${required}`);

assert.ok(contract.includes("JOB_INTAKE_RATE_SOURCE_MISMATCH"), "missing server-side Intake rate-source rejection");
for (const required of [
  "CONTRACT_ITEM_APU_INVALID",
  "CONTRACT_ITEM_APU_CURRENCY_MISMATCH",
]) assert.ok(financialApu.includes(required), `missing server-side APU rejection: ${required}`);

for (const gate of [
  "artifacts/bimlog/src/lib/job-intake-apu-connection.behavior.ts",
  "artifacts/bimlog/src/lib/job-intake-apu-default.behavior.ts",
  "artifacts/bimlog/src/lib/job-intake-apu-autobind.behavior.ts",
  "artifacts/bimlog/src/components/job-intake/CommercialIntake.behavior.tsx",
  "artifacts/bimlog/src/components/job-intake/ContractItemBulkEditor.behavior.tsx",
  "artifacts/api-server/src/lib/job-intake-apu-reload.behavior.ts",
  "artifacts/api-server/src/lib/job-intake-apu-history.behavior.ts",
  "artifacts/bimlog/src/lib/lorena-intake-correction-integration.behavior.ts",
]) runTsGate(gate);

console.log("GA terminal Build 003: PASS saved APU selection, exact unit-rate authority and reload persistence");
