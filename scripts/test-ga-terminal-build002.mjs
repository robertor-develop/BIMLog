import assert from "node:assert/strict";
import fs from "node:fs";
import { runTsGate } from "./lib/observable-gate-runner.mjs";

const contract = fs.readFileSync("artifacts/api-server/src/lib/job-intake-contract.ts", "utf8");
const service = fs.readFileSync("artifacts/api-server/src/lib/job-intake-service.ts", "utf8");
const connection = fs.readFileSync("artifacts/bimlog/src/components/job-intake/IntakeContractConnection.tsx", "utf8");

for (const required of [
  "JOB_INTAKE_CONTRACT_ID_DUPLICATE",
  "JOB_INTAKE_SCOPE_ID_REQUIRED",
  "JOB_INTAKE_SCOPE_ID_DUPLICATE",
  "JOB_INTAKE_CONTRACT_ITEM_PROFILE_INVALID",
  "JOB_INTAKE_EXISTING_CONTRACT_INCOMPLETE",
]) assert.ok(contract.includes(required), `missing canonical Intake contract authority: ${required}`);

for (const required of [
  "stableLineId: item.id",
  "contractProfileId: contract.id",
  "contract_id=$2,contract_version_id=$3",
  "activatedLineageReceipt(intake.activation_summary, intake.activated_contract_id)",
]) assert.ok(service.includes(required), `missing stable contract/line lineage: ${required}`);

for (const required of [
  "intakeCreatedContracts",
  "existingContractId",
  "encodeURIComponent(contract.contractId)",
]) assert.ok(connection.includes(required), `missing canonical contract reopen link: ${required}`);

for (const gate of [
  "artifacts/api-server/src/lib/job-intake.behavior.ts",
  "artifacts/api-server/src/lib/ux137-intake-contract-items.behavior.ts",
  "artifacts/api-server/src/lib/ux138-existing-contract-reconciliation.behavior.ts",
  "artifacts/api-server/src/lib/ux140-activation-retry.behavior.ts",
  "artifacts/bimlog/src/components/job-intake/CommercialIntake.behavior.tsx",
  "artifacts/bimlog/src/components/job-intake/ContractItemBulkEditor.behavior.tsx",
]) runTsGate(gate);

console.log("GA terminal Build 002: PASS canonical contract and stable Contract Item authority");
