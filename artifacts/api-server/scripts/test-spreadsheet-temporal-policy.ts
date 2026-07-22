import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import {
  canonicalSpreadsheetJsonOptions,
  canonicalSpreadsheetInput,
  canonicalSpreadsheetReadOptions,
  canonicalSpreadsheetWriteOptions,
  classifySpreadsheetTemporalText,
  normalizeSpreadsheetDateOnly,
  spreadsheetDateOnlyToUtcDate,
} from "@workspace/api-zod";

const dateSerial = (serial: number) => XLSX.SSF.parse_date_code(serial);
const expectedDates = ["2026-01-15", "2026-03-08", "2026-07-22", "2026-11-01"];

for (const value of expectedDates) {
  assert.equal(normalizeSpreadsheetDateOnly(value), value);
  assert.equal(spreadsheetDateOnlyToUtcDate(value)?.toISOString(), `${value}T00:00:00.000Z`);
}
assert.deepEqual(classifySpreadsheetTemporalText("2026-07-22T10:30:00-04:00"), {
  kind: "explicit-instant",
  value: "2026-07-22T14:30:00.000Z",
});
assert.deepEqual(classifySpreadsheetTemporalText("2026-07-22T10:30:00"), {
  kind: "timezone-less-date-time",
  value: "2026-07-22T10:30:00",
});
assert.equal(normalizeSpreadsheetDateOnly("2026-07-22T10:30:00"), null);

for (const bom of [false, true]) {
  const csv = `${bom ? "\uFEFF" : ""}Date,Label,Raw\n2026-07-22,Español,00123\n`;
  for (const type of ["buffer", "binary"] as const) {
    const input = type === "buffer" ? Buffer.from(csv, "utf8") : Buffer.from(csv, "utf8").toString("binary");
    const spreadsheet = canonicalSpreadsheetInput(input, "fixture.csv", type, {});
    const workbook = XLSX.read(spreadsheet.data, spreadsheet.options);
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets[workbook.SheetNames[0]],
      canonicalSpreadsheetJsonOptions({ raw: true, defval: "" }),
    );
    assert.equal(rows[0].Date, "2026-07-22");
    assert.equal(rows[0].Label, "Español");
    assert.equal(rows[0].Raw, "00123");
  }
}

for (const bookType of ["xlsx", "xls"] as const) {
  const sheet = XLSX.utils.aoa_to_sheet([["Date", "Decimal"], [new Date("2026-07-22T00:00:00.000Z"), 123.456]], canonicalSpreadsheetWriteOptions({ cellDates: true }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Policy");
  const bytes = XLSX.write(workbook, canonicalSpreadsheetWriteOptions({ type: "buffer", bookType, cellDates: true }));
  const parsed = XLSX.read(bytes, canonicalSpreadsheetReadOptions(`fixture.${bookType}`, "buffer", { cellDates: false, cellFormula: true }));
  const parsedSheet = parsed.Sheets.Policy;
  assert.equal(normalizeSpreadsheetDateOnly(parsedSheet.A2.v, dateSerial), "2026-07-22");
  assert.equal(parsedSheet.B2.v, 123.456);
}

console.log(JSON.stringify({
  status: "passed",
  timezone: process.env.TZ || "system-default",
  cases: {
    dateOnly: expectedDates,
    explicitOffset: true,
    timezoneLessPreserved: true,
    csvUtf8BomAndPlain: true,
    serverBufferAndBrowserArray: true,
    xlsAndXlsxNumericDates: true,
    decimalParity: true,
  },
}));
