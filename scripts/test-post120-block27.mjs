import assert from "node:assert/strict";
import fs from "node:fs";

const read = (relative) => fs.readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");
const json = (relative) => JSON.parse(read(relative));
const normalized = json("evidence/stabilization-program-20260919/PLATFORM_AUDIT_NORMALIZED.json");
const workflow = json("evidence/stabilization-program-20260919/BLOCK_27_WORKFLOW_DOCUMENT_FAILURE_CLASSIFICATION.json");
const reports = json("evidence/stabilization-program-20260919/BLOCK_27_EXPORT_REPORT_FAILURE_CLASSIFICATION.json");

assert.equal(normalized.counts.P0, 0);
assert.equal(normalized.counts.P1, 44);
assert.equal(normalized.rootCauseGroups.length, 26);
assert.equal(normalized.baseline.unexpectedP1.length, 0);
assert.equal(normalized.baseline.resolvedP1.length, 22);
assert.equal(workflow.classification.length, 8);
assert.equal(reports.classification.flatMap((item) => item.findingIds).length, 9);

const operational = read("artifacts/api-server/src/lib/operational-failure.ts");
const intake = read("artifacts/api-server/src/lib/job-intake-service.ts");
const intakeUi = read("artifacts/bimlog/src/pages/JobIntakeWorkspace.tsx");
const meetings = read("artifacts/bimlog/src/pages/project/MeetingsTab.tsx");
const sharing = read("artifacts/bimlog/src/components/OptionalSharePanel.tsx");
const packages = read("artifacts/api-server/src/lib/feedback-package-worker.ts");
const delivery = read("artifacts/api-server/src/lib/telegram-product-delivery.ts");
const telegram = read("artifacts/api-server/src/lib/telegram-product.ts");
const clashes = read("artifacts/api-server/src/routes/clash_reports.ts");

for (const code of [
  "JOB_INTAKE_IMPORT_ROLLBACK_FAILED",
  "JOB_INTAKE_UPLOAD_ROLLBACK_FAILED",
  "JOB_INTAKE_ACTIVATION_ROLLBACK_FAILED",
  "FEEDBACK_PACKAGE_MANIFEST_CLEANUP_FAILED",
  "FEEDBACK_PACKAGE_PDF_CLEANUP_FAILED",
  "FEEDBACK_PACKAGE_DOCX_CLEANUP_FAILED",
  "FEEDBACK_PACKAGE_WORKBOOK_CLEANUP_FAILED",
  "FEEDBACK_PACKAGE_UNLOCK_FAILED",
  "TELEGRAM_DELIVERY_RESPONSE_INVALID",
  "TELEGRAM_TEXT_RESPONSE_INVALID",
  "TELEGRAM_DOCUMENT_RESPONSE_INVALID",
  "LENS_NEXT_CREATE_FAILURE_SERIALIZATION_FAILED",
]) assert.match(operational, new RegExp(code));

assert.doesNotMatch(intake, /client\.query\("ROLLBACK"\)[\s\S]{0,40}catch\s*\{\s*\}/);
assert.doesNotMatch(`${intakeUi}\n${meetings}\n${sharing}`, /\.catch\(\(\)\s*=>\s*undefined\)/);
assert.doesNotMatch(packages, /storage\.delete\([^\n]+\)[^\n]*catch\s*\{\s*\}/);
assert.doesNotMatch(`${delivery}\n${telegram}`, /response\.json\(\)\.catch\(\(\)\s*=>\s*null\)/);
assert.match(clashes, /LENS_NEXT_CREATE_FAILURE_SERIALIZATION_FAILED/);

console.log("POST120_BLOCK27=PASS resolvedP1=22 currentP1=44 rootCauseGroups=26 diagnostics=code-only");
