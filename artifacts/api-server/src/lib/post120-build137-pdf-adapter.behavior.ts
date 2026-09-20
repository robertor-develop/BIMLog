import assert from "node:assert/strict";
import {
  applyPdfDownloadHeaders,
  pdfDownloadDisposition,
  pdfDownloadFileName,
  reportFileName,
} from "./pdf-kit";

assert.equal(reportFileName("RFI — Current View"), "RFI-Current-View.pdf");
assert.equal(pdfDownloadFileName("RFI — Current View"), "RFI-Current-View.pdf");
assert.equal(pdfDownloadFileName({ fileName: "../unsafe/\r\nReporte ñ.pdf" }), "Reporte ñ.pdf");
assert.equal(pdfDownloadFileName({ fileName: "..." }), "BIMLog-Report.pdf");
assert.equal(
  pdfDownloadDisposition({ fileName: "Reporte ñ.pdf" }),
  "attachment; filename=\"Reporte-n.pdf\"; filename*=UTF-8''Reporte%20%C3%B1.pdf",
);

const headers = new Map<string, string>();
applyPdfDownloadHeaders({
  type(value) { headers.set("Content-Type", value); },
  setHeader(name, value) { headers.set(name, value); },
}, { fileName: "Project Directory — Current View.pdf" });
assert.equal(headers.get("Content-Type"), "application/pdf");
assert.equal(headers.get("X-Content-Type-Options"), "nosniff");
assert.equal(headers.get("Cache-Control"), "private, no-store");
assert.match(headers.get("Content-Disposition") ?? "", /^attachment; filename="[\x20-\x7e]+"; filename\*=UTF-8''/u);
assert.doesNotMatch(headers.get("Content-Disposition") ?? "", /[\r\n]/u);

console.log("POST120_BUILD137=PASS safe-filename rfc5987 no-store nosniff legacy-title-compatible");
