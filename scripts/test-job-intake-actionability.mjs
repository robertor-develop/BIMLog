import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("artifacts/bimlog/src/pages/JobIntakeWorkspace.tsx", "utf8");
const assistant = readFileSync("artifacts/bimlog/src/components/layout/PageAssistant.tsx", "utf8");
const context = readFileSync("artifacts/bimlog/src/lib/page-assistant-context.ts", "utf8");

for (const anchor of [
  "ji-job-name", "ji-job-code", "ji-client", "ji-contract-contractNumber",
  "ji-contract-counterpartyName", "ji-contract-item-assignment",
  "ji-submittal-strategy", "ji-review",
]) assert.match(`${page}\n${readFileSync("artifacts/bimlog/src/lib/job-intake-activation-preview.ts", "utf8")}`, new RegExp(anchor));

assert.match(page, /JOB_INTAKE_STALE/);
assert.match(page, /latest\.data.*lastSavedRef\.current/s);
assert.match(page, /\[\$\{cause\.code\}\]/);
assert.match(assistant, /collectPageAssistantContext\(lang\).*setBusy/s);
assert.match(context, /main \[role=alert\]/);
assert.match(assistant, /replace\(\/\\\*\\\*/);
console.log("PASS actionable Job Intake controls, save diagnosis, and fresh assistant context");
