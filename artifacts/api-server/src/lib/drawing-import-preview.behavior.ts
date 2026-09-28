import assert from "node:assert/strict";
import { confirmDrawingImport, previewDrawingImport } from "./drawing-import-preview";

const preview = previewDrawingImport({ tenantId: 31, projectId: 26, fileId: 900, fileSha256: "a".repeat(64),
  sheetNumber: { value: "A-101", confidence: .72, source: "pdf_text" }, title: { value: "Ground Floor", confidence: .55, source: "filename" },
  discipline: { value: null, confidence: 0, source: "pdf_text" } });
assert.equal(preview.committable, false);
assert.equal(preview.uncertaintyVisible, true);
assert.equal(preview.fields.find(field => field.name === "discipline")?.value, null);
assert.throws(() => confirmDrawingImport(preview, { sheetNumber: "A-101", title: "Ground Floor", discipline: "" }), /CONFIRMATION_INCOMPLETE/);
const confirmed = confirmDrawingImport(preview, { sheetNumber: "A-101", title: "Ground Floor", discipline: "Architecture" });
assert.equal(confirmed.committable, true);
assert.equal(confirmed.confirmedManually, true);
console.log("C057 drawing import preview exposes uncertainty and requires complete manual confirmation: PASS");
