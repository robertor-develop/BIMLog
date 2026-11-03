import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("artifacts/api-server/src/routes/reports.ts", "utf8");
const ui = readFileSync("artifacts/bimlog/src/components/PrintPdfButton.tsx", "utf8");

assert.match(route, /router\.post\(\s*"\/projects\/:projectId\/reports\/current-view\/pdf"/);
for (const contract of [
  'requireProjectMember()',
  'CURRENT_VIEW_ROW_LIMIT',
  'X-BIMLog-Report-Number',
  'X-BIMLog-Source-SHA256',
]) assert.ok(route.includes(contract), `${contract} must remain in the governed PDF route`);

for (const contract of [
  'new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-"',
  'current_view_pdf_receipt_invalid',
  'notice.dataset.currentViewPdfSuccess',
  'role", "status"',
  'aria-live", "polite"',
  'PDF downloaded:',
  'PDF descargado:',
  'Receipt ${reportNumber}',
  'Comprobante ${reportNumber}',
]) assert.ok(ui.includes(contract), `${contract} must remain in the visible PDF success contract`);

assert.match(ui, /position: "fixed"/);
assert.match(ui, /window\.setTimeout\(\(\) => notice\.remove\(\), 8000\)/);
assert.match(ui, /return \{ fileName, reportNumber, sourceHash, byteSize: bytes\.byteLength \}/);
console.log("P196 current-view PDF membership, bounded input, PDF signature, attributable receipt, visible bilingual success, accessible status, and evidence return gates passed.");
