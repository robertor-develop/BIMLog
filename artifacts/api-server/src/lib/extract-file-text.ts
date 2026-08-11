import * as XLSX from "xlsx";
import {
  canonicalSpreadsheetInput,
  canonicalSpreadsheetJsonOptions,
} from "@workspace/api-zod";

const CHUNK_SIZE = 80000;
const SMART_INTAKE_MAX_SHEETS = 25;
const SMART_INTAKE_MAX_ROWS_PER_SHEET = 501;
const SMART_INTAKE_MAX_COLUMNS = 100;

export type SpreadsheetSheetPreview = {
  name: string;
  rowCount: number;
  columnCount: number;
  truncated: boolean;
  rows: Array<Array<string | number | boolean>>;
};

function previewCell(value: unknown): string | number | boolean {
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  return String(value ?? "").slice(0, 1000);
}

function inspectSheet(
  sheetName: string,
  sheet: XLSX.WorkSheet,
): SpreadsheetSheetPreview {
  const rawRows = XLSX.utils.sheet_to_json(
    sheet,
    canonicalSpreadsheetJsonOptions({ header: 1, defval: "", raw: true }),
  ) as unknown[][];
  let lastPopulatedRow = -1;
  let columnCount = 0;
  rawRows.forEach((row, index) => {
    const populated = row.reduce<number>(
      (last, value, columnIndex) =>
        String(value ?? "").trim() ? columnIndex : last,
      -1,
    );
    if (populated >= 0) {
      lastPopulatedRow = index;
      columnCount = Math.max(columnCount, populated + 1);
    }
  });
  const rowCount = lastPopulatedRow + 1;
  const boundedColumns = Math.min(columnCount, SMART_INTAKE_MAX_COLUMNS);
  const rows = rawRows
    .slice(0, Math.min(rowCount, SMART_INTAKE_MAX_ROWS_PER_SHEET))
    .map((row) =>
      Array.from({ length: boundedColumns }, (_, index) =>
        previewCell(row[index]),
      ),
    );
  return {
    name: sheetName,
    rowCount,
    columnCount,
    truncated:
      rowCount > SMART_INTAKE_MAX_ROWS_PER_SHEET ||
      columnCount > SMART_INTAKE_MAX_COLUMNS,
    rows,
  };
}

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += CHUNK_SIZE) {
    chunks.push(text.slice(i, i + CHUNK_SIZE));
  }
  return chunks.length > 0 ? chunks : [""];
}

export async function extractFileText(
  buffer: Buffer,
  filename: string,
): Promise<{
  text: string;
  isSpreadsheet: boolean;
  rows?: any[][];
  sheets?: SpreadsheetSheetPreview[];
  workbookSheetCount?: number;
  sheetsTruncated?: boolean;
  chunks: string[];
  isPdf: boolean;
  pdfBase64?: string;
}> {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const isSpreadsheet = ["xlsx", "xlsm", "xls", "csv"].includes(ext);
  const isPdf = ext === "pdf";

  if (isSpreadsheet) {
    try {
      const hasZipSignature = buffer[0] === 0x50 && buffer[1] === 0x4b;
      const hasCompoundFileSignature =
        buffer[0] === 0xd0 &&
        buffer[1] === 0xcf &&
        buffer[2] === 0x11 &&
        buffer[3] === 0xe0;
      if (
        ((ext === "xlsx" || ext === "xlsm") && !hasZipSignature) ||
        (ext === "xls" && !hasCompoundFileSignature)
      )
        throw new Error("Spreadsheet signature does not match its extension.");
      const spreadsheet = canonicalSpreadsheetInput(
        buffer,
        filename,
        "buffer",
        {},
      );
      const workbook = XLSX.read(spreadsheet.data, spreadsheet.options);
      const sheets = workbook.SheetNames.slice(0, SMART_INTAKE_MAX_SHEETS)
        .map((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          return sheet ? inspectSheet(sheetName, sheet) : null;
        })
        .filter((sheet): sheet is SpreadsheetSheetPreview => Boolean(sheet));
      let bestSheet = workbook.Sheets[workbook.SheetNames[0]];
      let bestRowCount = 0;
      for (const sheetName of workbook.SheetNames) {
        const s = workbook.Sheets[sheetName];
        const r = XLSX.utils.sheet_to_json(
          s,
          canonicalSpreadsheetJsonOptions({ header: 1, defval: "", raw: true }),
        ) as any[][];
        const dataCount = r.filter(
          (row: any[]) => row.filter((c: any) => String(c).trim()).length > 2,
        ).length;
        if (dataCount > bestRowCount) {
          bestRowCount = dataCount;
          bestSheet = s;
        }
      }
      const rows = XLSX.utils.sheet_to_json(
        bestSheet,
        canonicalSpreadsheetJsonOptions({ header: 1, defval: "", raw: true }),
      ) as any[][];
      const text = rows.map((r: any[]) => r.join("\t")).join("\n");
      const chunks = chunkText(text);
      return {
        text: chunks[0],
        isSpreadsheet: true,
        rows,
        sheets,
        workbookSheetCount: workbook.SheetNames.length,
        sheetsTruncated: workbook.SheetNames.length > SMART_INTAKE_MAX_SHEETS,
        chunks,
        isPdf: false,
      };
    } catch {
      console.error("[extract-file-text] Spreadsheet parse failed safely.");
      throw new Error("The spreadsheet source could not be parsed safely.");
    }
  }

  if (isPdf) {
    const pdfBase64 = buffer.toString("base64");
    console.log(
      "[extract-file-text] PDF ready for Claude vision:",
      buffer.length,
      "bytes",
    );
    return {
      text: "",
      isSpreadsheet: false,
      chunks: [""],
      isPdf: true,
      pdfBase64,
    };
  }

  const text = buffer.toString("utf-8");
  return { text, isSpreadsheet: false, chunks: chunkText(text), isPdf: false };
}
