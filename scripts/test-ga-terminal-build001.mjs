import assert from "node:assert/strict";
import fs from "node:fs";
import { runTsGate } from "./lib/observable-gate-runner.mjs";

const workspace = fs.readFileSync("artifacts/bimlog/src/pages/JobIntakeWorkspace.tsx", "utf8");
const service = fs.readFileSync("artifacts/api-server/src/lib/job-intake-service.ts", "utf8");

for (const required of [
  'clientCompanyId: selected?.id ?? null',
  'clientCompanyId: created.id',
  'setSaveState("saved")',
  'jobIntakeSavedSignalKey(projectId)',
]) assert.ok(workspace.includes(required), `missing Job Intake identity control: ${required}`);

for (const required of [
  "jobName: access.projectName",
  "jobCode: access.projectCode",
  "clientCompany: access.clientCompany",
  "export async function saveJobIntake",
]) assert.ok(service.includes(required), `missing canonical Job Intake persistence: ${required}`);

for (const gate of [
  "artifacts/api-server/src/lib/job-intake.behavior.ts",
  "artifacts/bimlog/src/lib/job-intake-directory-options.behavior.ts",
  "artifacts/bimlog/src/lib/job-intake-draft-resume.behavior.ts",
  "artifacts/bimlog/src/components/job-intake/ProjectCompanyCreator.behavior.tsx",
  "artifacts/bimlog/src/components/job-intake/ProjectContactCreator.behavior.tsx",
]) runTsGate(gate);

console.log("GA terminal Build 001: PASS canonical project/company identity create-save-reopen contract");
