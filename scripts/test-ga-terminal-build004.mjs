import assert from "node:assert/strict";
import fs from "node:fs";
import { runTsGate } from "./lib/observable-gate-runner.mjs";

const defaults = fs.readFileSync("artifacts/bimlog/src/lib/job-intake-delivery-defaults.ts", "utf8");
const intake = [
  fs.readFileSync("artifacts/bimlog/src/components/job-intake/IntakeDeliveryItems.tsx", "utf8"),
  fs.readFileSync("artifacts/bimlog/src/components/job-intake/ContractItemBulkEditor.tsx", "utf8"),
].join("\n");
const contract = fs.readFileSync("artifacts/api-server/src/lib/job-intake-contract.ts", "utf8");

for (const required of [
  "selectPublishedDeliveryWorkflow",
  "deliveryWorkflowGeneratedStrategy",
  "deliveryWorkflowGeneratedMilestones",
  "hydrateSelectedDeliveryWorkflowGuidance",
]) assert.ok(defaults.includes(required), `missing immutable workflow guidance authority: ${required}`);

for (const required of [
  "Delivery Workflow version",
  "Submittal strategy",
  "Milestones and distribution",
  "selectPublishedDeliveryWorkflow",
]) assert.ok(intake.includes(required), `missing visible Delivery workflow journey: ${required}`);

for (const required of [
  "deliveryWorkflowVersionId",
  "deliveryWorkflowGeneratedStrategy",
  "deliveryWorkflowGeneratedMilestones",
]) assert.ok(contract.includes(required), `missing persisted Delivery workflow field: ${required}`);

for (const gate of [
  "artifacts/bimlog/src/lib/job-intake-delivery-defaults.behavior.ts",
  "artifacts/bimlog/src/lib/delivery-guidance-status.behavior.ts",
  "artifacts/bimlog/src/lib/intake-workflow-preview-selection.behavior.ts",
  "artifacts/api-server/src/lib/workflow-phase-hours.behavior.ts",
  "artifacts/bimlog/src/lib/lorena-intake-correction-integration.behavior.ts",
]) runTsGate(gate);

console.log("GA terminal Build 004: PASS immutable Delivery workflow selection, generated guidance and persistence");
