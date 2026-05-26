import * as XLSX from "xlsx";

async function parsePdf(buffer: Buffer): Promise<string> {
  try {
    const { default: pdfParse } = await import("pdf-parse");
    const data = await pdfParse(buffer);
    return data.text ?? "";
  } catch (err) {
    console.error("[extract-file-text] pdf-parse import failed:", err);
    return buffer.toString("utf-8");
  }
}

const CHUNK_SIZE = 80000;

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += CHUNK_SIZE) {
    chunks.push(text.slice(i, i + CHUNK_SIZE));
  }
  return chunks.length > 0 ? chunks : [""];
}

export async function extractFileText(buffer: Buffer, filename: string): Promise<{ text: string; isSpreadsheet: boolean; rows?: any[][]; chunks: string[] }> {
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
      const text = rows.map(r => r.join("\t")).join("\n");
      const chunks = chunkText(text);
      return { text: chunks[0], isSpreadsheet: true, rows, chunks };
    } catch (err) {
      console.error("[extract-file-text] Excel parse failed:", err);
      const text = buffer.toString("utf-8");
      return { text, isSpreadsheet: false, chunks: chunkText(text) };
    }
  }

  if (ext === "pdf") {
    try {
      const pdfText = await parsePdf(buffer);
      console.log("[extract-file-text] PDF extracted:", pdfText.length, "chars");
      const chunks = chunkText(pdfText);
      console.log("[extract-file-text] PDF chunks:", chunks.length);
      return { text: pdfText, isSpreadsheet: false, chunks };
    } catch (err) {
      console.error("[extract-file-text] PDF parse failed:", err);
      const text = buffer.toString("utf-8");
      return { text, isSpreadsheet: false, chunks: chunkText(text) };
    }
  }

  const text = buffer.toString("utf-8");
  return { text, isSpreadsheet: false, chunks: chunkText(text) };
}
