import * as XLSX from "xlsx";
import { canonicalSpreadsheetInput, canonicalSpreadsheetJsonOptions } from "@workspace/api-zod";

const CHUNK_SIZE = 80000;

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += CHUNK_SIZE) {
    chunks.push(text.slice(i, i + CHUNK_SIZE));
  }
  return chunks.length > 0 ? chunks : [""];
}

export async function extractFileText(
  buffer: Buffer,
  filename: string
): Promise<{ text: string; isSpreadsheet: boolean; rows?: any[][]; chunks: string[]; isPdf: boolean; pdfBase64?: string }> {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const isSpreadsheet = ["xlsx", "xls", "csv"].includes(ext);
  const isPdf = ext === "pdf";

  if (isSpreadsheet) {
    try {
      const spreadsheet = canonicalSpreadsheetInput(buffer, filename, "buffer", {});
      const workbook = XLSX.read(spreadsheet.data, spreadsheet.options);
      let bestSheet = workbook.Sheets[workbook.SheetNames[0]];
      let bestRowCount = 0;
      for (const sheetName of workbook.SheetNames) {
        const s = workbook.Sheets[sheetName];
        const r = XLSX.utils.sheet_to_json(s, canonicalSpreadsheetJsonOptions({ header: 1, defval: "", raw: true })) as any[][];
        const dataCount = r.filter((row: any[]) => row.filter((c: any) => String(c).trim()).length > 2).length;
        if (dataCount > bestRowCount) { bestRowCount = dataCount; bestSheet = s; }
      }
      const rows = XLSX.utils.sheet_to_json(bestSheet, canonicalSpreadsheetJsonOptions({ header: 1, defval: "", raw: true })) as any[][];
      const text = rows.map((r: any[]) => r.join("\t")).join("\n");
      const chunks = chunkText(text);
      return { text: chunks[0], isSpreadsheet: true, rows, chunks, isPdf: false };
    } catch (err) {
      console.error("[extract-file-text] Excel parse failed:", err);
      const text = buffer.toString("utf-8");
      return { text, isSpreadsheet: false, chunks: chunkText(text), isPdf: false };
    }
  }

  if (isPdf) {
    const pdfBase64 = buffer.toString("base64");
    console.log("[extract-file-text] PDF ready for Claude vision:", buffer.length, "bytes");
    return { text: "", isSpreadsheet: false, chunks: [""], isPdf: true, pdfBase64 };
  }

  const text = buffer.toString("utf-8");
  return { text, isSpreadsheet: false, chunks: chunkText(text), isPdf: false };
}
