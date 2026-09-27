import assert from "node:assert/strict";
import { financialCsvCell, isFinancialCalendarDate } from "./financial-export-contract";

for (const date of ["2024-02-29", "2000-02-29", "2026-04-30", "2026-12-31", "0001-01-01"])
  assert.equal(isFinancialCalendarDate(date), true, date);
for (const date of ["2026-02-29", "1900-02-29", "2026-02-30", "2026-04-31", "2026-13-01", "2026-00-10", "2026-01-00", "0000-01-01", "2026-1-01", "2026-01-01T00:00:00Z", ""])
  assert.equal(isFinancialCalendarDate(date), false, date);
for (const text of ["=1+1", "+1+1", "-1+1", "@example", " \t=1+1", "\r\n+1", "\u0000=1"])
  assert.equal(financialCsvCell(text), `"'${text}"`);
for (const text of ["-40.00", "0", "9007199254740993.01", "1.234567", "USD", "Español", "2026-09-27"])
  assert.equal(financialCsvCell(text), `"${text}"`);
assert.equal(financialCsvCell('quoted "text", next\nline'), '"quoted ""text"", next\nline"');
assert.equal(financialCsvCell(null), '""');
assert.equal(financialCsvCell(false), '"false"');
console.log("C019 financial export/calendar contract PASS");
