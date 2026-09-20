import assert from "node:assert/strict";
import { applyPdfDownloadHeaders, createPdfDocument } from "./pdf-kit";

const headers = new Map<string, string>();
applyPdfDownloadHeaders({ type(value) { headers.set("Content-Type", value); }, setHeader(name, value) { headers.set(name, value); } }, "Owner / Files — Current View");
assert.equal(headers.get("Content-Type"), "application/pdf");
assert.equal(headers.get("Content-Disposition"), 'attachment; filename="Owner-Files-Current-View.pdf"');
assert.equal(headers.get("X-Content-Type-Options"), "nosniff");
assert.equal(headers.get("Cache-Control"), "private, no-store");

const doc = createPdfDocument({ size: "LETTER", layout: "landscape", margin: 42, bufferPages: true });
doc.text("Representative owner report");
doc.addPage();
assert.equal(doc.page.width, 792);
assert.equal(doc.page.height, 612);
assert.equal(doc.page.margins.left, 42);
doc.end();
console.log("PASS Build 083 shared PDF headers, safe filenames, no-cache behavior, and continuation-page fidelity");
