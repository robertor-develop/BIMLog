import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import {
  chunkClashSource, clashImportFormat, clashStatusPresentation, deduplicateClashRows,
  emptyClashColumnMapping, mapClashSpreadsheetRows, nextClashReportNumber,
  normalizeAiClashRows, parseAiJsonArray, selectClashSpreadsheetRows,
} from "./clash-report-contracts";

assert.deepEqual(clashImportFormat("coordination.XML"), { extension: "xml", spreadsheet: false, xml: true, persistedFormat: "xml" });
assert.equal(chunkClashSource("abcdef", 2).length, 3);
assert.throws(() => chunkClashSource("x", 0), /CLASH_CHUNK_SIZE_INVALID/);
assert.equal(parseAiJsonArray("```json\n[]\n```").length, 0);
assert.throws(() => parseAiJsonArray("{}"), /CLASH_IMPORT_ARRAY_REQUIRED/);

const normalized = normalizeAiClashRows([
  { viewpoint: "C.001", description: "Pipe vs duct", discipline: "PB", status: "complete" },
  { viewpoint: "C.001", description: "duplicate" },
  { description: "No viewpoint remains valid" },
  null,
], "xml");
assert.equal(normalized[0].status, "resolved");
assert.equal(normalized[0].discipline1, "PB");
assert.equal(deduplicateClashRows(normalized).length, 2);

const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["note"], ["Viewpoint", "Description", "Trade"], ["C.001", "Pipe vs duct", "PB"]]), "Clashes");
const selected = selectClashSpreadsheetRows(workbook);
assert.deepEqual(selected.headers, ["viewpoint", "description", "trade"]);
const mapping = { ...emptyClashColumnMapping(), viewpoint: 0, description: 1, discipline: 2 };
assert.deepEqual(mapClashSpreadsheetRows(selected.rows, mapping).map(row => row.clashIdOriginal), ["C.001"]);

assert.equal(nextClashReportNumber("ABC", ["ABC-CR-001", "ABC-CR-003"]), "ABC-CR-004");
assert.equal(clashStatusPresentation("waiting_design", "es"), "Esperando Diseno");
assert.equal(clashStatusPresentation("custom_state", "en"), "custom state");

console.log("POST120_BUILD161=PASS parsing=separated identity=centralized presentation=centralized");
