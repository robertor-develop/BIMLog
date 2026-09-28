import assert from "node:assert/strict";
import { commonReportPresets, currentViewExportModel, renderCurrentViewExports } from "./report-view-presets";

const rows = [
  { dataset: "rfi" as const, recordId: "1", version: 1, status: "open", company: "BIMTECH" },
  { dataset: "submittal" as const, recordId: "2", version: 3, status: "under_review", company: "Reviewer" },
];
assert.equal(commonReportPresets.length, 2);
for (const language of ["en", "es"] as const) {
  const model = currentViewExportModel({ rows, visibleSourceKeys: ["rfi:1:v1"], language });
  const output = renderCurrentViewExports(model);
  assert.deepEqual(output.pdf.rows, output.excel.rows);
  assert.deepEqual(output.pdf.totals, output.excel.totals);
  assert.equal(output.pdf.fingerprint, output.excel.fingerprint);
  assert.equal(model.totals.rows, 1, "exports must use current visible scope, not the full dataset");
}
console.log("C040 common presets and current-view PDF/Excel parity: PASS");
