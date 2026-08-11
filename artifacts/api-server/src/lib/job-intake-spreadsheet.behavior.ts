import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { extractFileText } from "./extract-file-text";
import {
  normalizeJobIntakeData,
  previewSmartIntakeMapping,
} from "./job-intake-contract";

const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(
  workbook,
  XLSX.utils.aoa_to_sheet([["Read me"], ["The estimate is on another sheet."]]),
  "Instructions",
);
const estimateRows: unknown[][] = [
  ["Flexible estimate export"],
  ["Internal code", "Description supplied by estimator", "Measured amount"],
  ...Array.from({ length: 125 }, (_, index) => [
    `E-${index + 1}`,
    `Contract Item ${index + 1}`,
    String(index + 1),
  ]),
];
XLSX.utils.book_append_sheet(
  workbook,
  XLSX.utils.aoa_to_sheet(estimateRows),
  "Estimate 2026",
);

for (const bookType of ["xlsx", "xlsm"] as const) {
  const buffer = XLSX.write(workbook, { type: "buffer", bookType });
  const extracted = await extractFileText(buffer, `estimate.${bookType}`);
  assert.equal(extracted.isSpreadsheet, true);
  assert.deepEqual(
    extracted.sheets?.map((sheet) => sheet.name),
    ["Instructions", "Estimate 2026"],
  );
  const preview = previewSmartIntakeMapping({
    documentId: "doc-100",
    sourceHash: "a".repeat(64),
    fileName: `estimate.${bookType}`,
    sheets: extracted.sheets,
    sheetName: "Estimate 2026",
    headerRow: 2,
    nameColumn: 1,
    quantityColumn: 2,
  });
  assert.equal(preview.rows.length, 125);
  assert.equal(preview.issues.length, 0);
  const firstRow = preview.rows[0] as any;
  assert.equal(firstRow.name, "Contract Item 1");
  assert.equal(firstRow.quantity, "1");
  assert.equal((preview.rows[124] as any).quantity, "125");
  assert.equal(firstRow.provenance.sheetName, "Estimate 2026");
  assert.equal(firstRow.provenance.headerRow, 2);
  assert.equal(firstRow.provenance.sourceRow, 3);
  assert.match(firstRow.id, /^CI-[a-f0-9]{20}$/);
  assert.equal(new Set(preview.rows.map((row: any) => row.id)).size, 125);
  const repeated = previewSmartIntakeMapping({
    documentId: "doc-100",
    sourceHash: "a".repeat(64),
    fileName: `estimate.${bookType}`,
    sheets: extracted.sheets,
    sheetName: "Estimate 2026",
    headerRow: 2,
    nameColumn: 1,
    quantityColumn: 2,
  });
  assert.equal(repeated.mappingFingerprint, preview.mappingFingerprint);
  assert.equal((repeated.rows[0] as any).id, firstRow.id);
  const normalized = normalizeJobIntakeData({
    scopeItems: preview.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      plannedHours: row.quantity,
      billingHourlyRate: "30.25",
      unit: "Hours",
      workflowTemplate: "generic",
      provenance: row.provenance,
    })),
  });
  assert.equal(normalized.scopeItems.length, 125);
  assert.equal(normalized.scopeItems[0].contractValue, "30.25");
  assert.equal(normalized.scopeItems[0].workflowTemplate, "generic");
  assert.equal(normalized.scopeItems[0].provenance?.sourceHash, "a".repeat(64));
  assert.throws(
    () =>
      normalizeJobIntakeData({
        scopeItems: [normalized.scopeItems[0], normalized.scopeItems[0]],
      }),
    /IDs must be unique/i,
  );
}

const csv = Buffer.from("ignored,name,quantity\n1,Doors,12\n2,Frames,7.5\n", "utf8");
const csvExtracted = await extractFileText(csv, "estimate.csv");
const csvPreview = previewSmartIntakeMapping({
  documentId: "doc-csv",
  sourceHash: "b".repeat(64),
  fileName: "estimate.csv",
  sheets: csvExtracted.sheets,
  sheetName: csvExtracted.sheets?.[0]?.name,
  headerRow: 1,
  nameColumn: 1,
  quantityColumn: 2,
});
assert.deepEqual(
  csvPreview.rows.map((row: any) => [row.name, row.quantity]),
  [
    ["Doors", "12"],
    ["Frames", "7.5"],
  ],
);
const clipboardDraft = normalizeJobIntakeData({
  scopeItems: [
    {
      id: "CI-clipboard",
      name: "Pasted Item",
      plannedHours: "2",
      provenance: { source: "clipboard", sourceRow: 1 },
    },
  ],
});
assert.equal(clipboardDraft.scopeItems[0].provenance?.source, "clipboard");
assert.equal(clipboardDraft.scopeItems[0].provenance?.sourceRow, 1);

const ambiguous = previewSmartIntakeMapping({
  documentId: "doc-bad",
  sourceHash: "c".repeat(64),
  fileName: "ambiguous.xlsx",
  sheets: [
    {
      name: "Sheet1",
      rowCount: 3,
      columnCount: 2,
      truncated: false,
      rows: [["Item", "Qty"], ["Door", "1,200"], ["", "4"]],
    },
  ],
  sheetName: "Sheet1",
  headerRow: 1,
  nameColumn: 0,
  quantityColumn: 1,
});
assert.equal(ambiguous.rows.length, 0);
assert.deepEqual(
  ambiguous.issues.map((issue) => issue.code),
  ["quantity_invalid", "name_required"],
);

const manySheets = XLSX.utils.book_new();
for (let index = 0; index < 26; index += 1)
  XLSX.utils.book_append_sheet(
    manySheets,
    XLSX.utils.aoa_to_sheet([["Name", "Quantity"], [`Item ${index}`, 1]]),
    `Sheet ${index + 1}`,
  );
const manySheetsExtracted = await extractFileText(
  XLSX.write(manySheets, { type: "buffer", bookType: "xlsx" }),
  "many-sheets.xlsx",
);
assert.equal(manySheetsExtracted.workbookSheetCount, 26);
assert.equal(manySheetsExtracted.sheets?.length, 25);
assert.equal(manySheetsExtracted.sheetsTruncated, true);
const truncatedWorkbookPreview = previewSmartIntakeMapping({
  documentId: "doc-many",
  sourceHash: "d".repeat(64),
  fileName: "many-sheets.xlsx",
  sheets: manySheetsExtracted.sheets,
  sheetsTruncated: manySheetsExtracted.sheetsTruncated,
  sheetName: "Sheet 1",
  headerRow: 1,
  nameColumn: 0,
  quantityColumn: 1,
});
assert.equal(
  truncatedWorkbookPreview.issues.at(-1)?.code,
  "workbook_sheets_truncated",
);

await assert.rejects(
  () => extractFileText(Buffer.from("not a workbook"), "unsafe.xlsx"),
  /could not be parsed safely/i,
);

console.log("job-intake-spreadsheet.behavior: PASS");
