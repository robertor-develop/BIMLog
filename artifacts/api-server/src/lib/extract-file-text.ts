import * as pdfParseMod from "pdf-parse";
const pdfParse: (buf: Buffer) => Promise<{ text: string }> = (pdfParseMod as any).default ?? (pdfParseMod as any);
import * as XLSX from "xlsx";

export async function extractFileText(buffer: Buffer, filename: string): Promise<{ text: string; isSpreadsheet: boolean; rows?: any[][] }> {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const isSpreadsheet = ["xlsx", "xls", "csv"].includes(ext);

  if (isSpreadsheet) {
    try {
      const workbook = XLSX.read(buffer, { type: "buffer" });
      let bestSheet = workbook.Sheets[workbook.SheetNames[0]];
      let bestRowCount = 0;
      for (const sheetName of workbook.SheetNames) {
        const s = workbook.Sheets[sheetName];
        const r = XLSX.utils.sheet_to_json(s, { header: 1, defval: "" }) as any[][];
        const dataCount = r.filter((row: any[]) => row.filter((c: any) => String(c).trim()).length > 2).length;
        if (dataCount > bestRowCount) { bestRowCount = dataCount; bestSheet = s; }
      }
      const rows = XLSX.utils.sheet_to_json(bestSheet, { header: 1, defval: "" }) as any[][];
      const text = rows.map(r => r.join("\t")).join("\n").slice(0, 15000);
      return { text, isSpreadsheet: true, rows };
    } catch (err) {
      console.error("[extract-file-text] Excel parse failed:", err);
      return { text: buffer.toString("utf-8").slice(0, 15000), isSpreadsheet: false };
    }
  }

  if (ext === "pdf") {
    try {
      const pdfData = await pdfParse(buffer);
      console.log("[extract-file-text] PDF extracted:", pdfData.text.slice(0, 100));
      return { text: pdfData.text.slice(0, 15000), isSpreadsheet: false };
    } catch (err) {
      console.error("[extract-file-text] PDF parse failed:", err);
      return { text: buffer.toString("utf-8").slice(0, 15000), isSpreadsheet: false };
    }
  }

  return { text: buffer.toString("utf-8").slice(0, 15000), isSpreadsheet: false };
}
