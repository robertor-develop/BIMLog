import assert from "node:assert/strict";
import fs from "node:fs";
import { runTsGate } from "./lib/observable-gate-runner.mjs";

const plan = fs.readFileSync("artifacts/bimlog/src/components/job-intake/GenericResourcePlan.tsx", "utf8");
const workspace = fs.readFileSync("artifacts/bimlog/src/pages/JobIntakeWorkspace.tsx", "utf8");
const contract = fs.readFileSync("artifacts/api-server/src/lib/job-intake-contract.ts", "utf8");

for (const required of [
  "No resource budget yet. You can activate with staffing pending.",
  "Add planned role",
  "assignmentTargetType:'contract_item'",
  "userId:null",
  "personName:\"\"",
  "Scope item ${index + 1}",
  "Resource quantity ${index + 1}",
  "Planned hours ${index + 1}",
]) assert.ok(plan.includes(required), `missing controlled Resource budget behavior: ${required}`);

for (const required of ["GenericResourcePlan", "team.assignments", "Resource budget"])
  assert.ok(workspace.includes(required), `missing Resource budget workspace binding: ${required}`);

for (const required of ["resourceCount", "plannedHours", "internalHourlyRate", "assignmentTargetType"])
  assert.ok(contract.includes(required), `missing persisted Resource budget field: ${required}`);

for (const gate of [
  "artifacts/api-server/src/lib/ux-block25-resource-demand.behavior.ts",
  "artifacts/api-server/src/lib/job-intake.behavior.ts",
  "artifacts/bimlog/src/pages/JobIntakeWorkspace.item-bindings.behavior.ts",
]) runTsGate(gate);

console.log("GA terminal Build 005: PASS optional role plan, Contract Item binding, accessible controls and persistence");
