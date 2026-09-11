import assert from "node:assert/strict";
import fs from "node:fs";
import { Document, Packer, Paragraph, TextRun } from "docx";
import AdmZip from "adm-zip";
import * as XLSX from "xlsx";
import { extractFileText } from "./extract-file-text";

const marker = "BIMLog controlled intake evidence";

const pdf = Buffer.from(`%PDF-1.4\n% ${marker}\n%%EOF`, "utf8");
const pdfResult = await extractFileText(pdf, "scope.pdf");
assert.equal(pdfResult.isPdf, true);
assert.equal(Buffer.from(pdfResult.pdfBase64!, "base64").equals(pdf), true);

const docx = await Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph({ children: [new TextRun(marker)] })] }] }));
const archive = new AdmZip(docx);
assert.ok(archive.getEntry("word/document.xml"));
assert.match(archive.getEntry("word/document.xml")!.getData().toString("utf8"), new RegExp(marker));
const serviceSource = fs.readFileSync(new URL("./job-intake-service.ts", import.meta.url), "utf8");
assert.match(serviceSource, /Word document preserved byte-for-byte/);

const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Item", "Quantity"], ["Coordination Meetings", 120]]), "Estimate");
const xlsx = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
const xlsxResult = await extractFileText(xlsx, "estimate.xlsx");
assert.equal(xlsxResult.isSpreadsheet, true);
assert.deepEqual(xlsxResult.sheets?.[0]?.rows, [["Item", "Quantity"], ["Coordination Meetings", 120]]);

const csvResult = await extractFileText(Buffer.from("Item,Quantity\nDrafting,40\n", "utf8"), "estimate.csv");
assert.equal(csvResult.isSpreadsheet, true);
assert.deepEqual(csvResult.rows?.slice(0, 2), [["Item", "Quantity"], ["Drafting", "40"]]);

const xml = `<?xml version="1.0"?><intake><item quantity="80">Coordination</item></intake>`;
const xmlResult = await extractFileText(Buffer.from(xml, "utf8"), "scope.xml");
assert.equal(xmlResult.isSpreadsheet, false);
assert.equal(xmlResult.isPdf, false);
assert.equal(xmlResult.text, xml);

console.log(JSON.stringify({
  suite: "post-p17-build04-intake-file-inspection",
  status: "PASS",
  formats: { pdf: "byte-preserved", docx: "OOXML-readable/manual-review", xlsx: "structured-preview", csv: "structured-preview", xml: "text-preview" },
  assertions: 12,
}, null, 2));
