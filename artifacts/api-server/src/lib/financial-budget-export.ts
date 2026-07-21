import PDFDocument from "pdfkit";
import * as XLSX from "xlsx";
import AdmZip from "adm-zip";
import { FinancialControlError } from "./financial-control-contract";
import { exactSignedDecimal } from "./financial-budget-contract";

export type BaselineExport = {
  project: { name: string; code: string; companyName: string };
  snapshot: {
    id: string;
    budgetVersion: number;
    currency: string;
    originalTotal: string;
    currentTotal: string;
    differenceFromOriginal: string;
    contentFingerprint: string;
    snapshotFingerprint: string;
    approvedAt: string;
    approvedByName: string;
    approvalLimit: string;
    lines: Array<{
      projectCode: string;
      projectName: string;
      hierarchicalPath: string;
      description: string;
      amount: string;
      quantity?: string | null;
      unit?: string | null;
      unitRate?: string | null;
      notes?: string | null;
      sortOrder: number;
    }>;
  };
  generatedAt: string;
};
const safe = (v: unknown) => {
  const s = String(v ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim();
  if (/^[=+\-@\t\r]/.test(s)) return `'${s}`;
  if (
    /(?:storage[_ ]?path|[A-Za-z]:\\|https?:\/\/\S*[?&](?:token|key|signature)=)/i.test(
      s,
    )
  )
    return "Protected value";
  return s;
};
export async function buildBaselinePdf(data: BaselineExport): Promise<Buffer> {
  const doc = new PDFDocument({
      size: "LETTER",
      margin: 42,
      bufferPages: true,
      info: {
        Title: `Approved Budget Baseline - ${safe(data.project.code)}`,
        Author: "BIMLog",
        Subject: "Operational approved project budget baseline",
      },
    }),
    chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  doc
    .fontSize(18)
    .text("BIMLog Approved Budget Baseline")
    .fontSize(10)
    .text("Operational budget record — not an accounting certification.")
    .moveDown();
  doc
    .fontSize(11)
    .text(
      `${safe(data.project.companyName)} | ${safe(data.project.name)} (${safe(data.project.code)})`,
    );
  doc.text(
    `Budget version: ${data.snapshot.budgetVersion} | Status: Approved | Currency: ${data.snapshot.currency}`,
  );
  doc.text(
    `Original Budget: ${data.snapshot.originalTotal}   Current Budget: ${data.snapshot.currentTotal}   Difference from Original: ${data.snapshot.differenceFromOriginal}`,
  );
  doc.text(
    `Approved: ${safe(data.snapshot.approvedByName)} at ${data.snapshot.approvedAt} | Applicable limit: ${data.snapshot.approvalLimit}`,
  );
  doc.moveDown().fontSize(9);
  for (const line of data.snapshot.lines) {
    if (doc.y > 700) doc.addPage();
    doc
      .text(
        `${safe(line.hierarchicalPath)}  ${safe(line.projectName)}`,
        42,
        doc.y,
        { continued: true, width: 400 },
      )
      .text(`${line.amount} ${data.snapshot.currency}`, { align: "right" });
    doc
      .fillColor("#555555")
      .text(safe(line.description), 54, doc.y, { width: 500 })
      .fillColor("#000000");
  }
  doc
    .moveDown()
    .fontSize(8)
    .text(`Content fingerprint: ${data.snapshot.contentFingerprint}`)
    .text(`Snapshot fingerprint: ${data.snapshot.snapshotFingerprint}`)
    .text(`Generated: ${data.generatedAt}`);
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    doc.fontSize(8).text(`Page ${i + 1} of ${range.count}`, 42, 742, {
      align: "right",
      width: 528,
    });
  }
  doc.end();
  return new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}
export function buildBaselineXlsx(data: BaselineExport): Buffer {
  const rows = data.snapshot.lines.map((line) => ({
    Hierarchy: safe(line.hierarchicalPath),
    "Cost Code": safe(line.projectCode),
    Name: safe(line.projectName),
    Description: safe(line.description),
    Amount: exactSignedDecimal(line.amount),
    Currency: data.snapshot.currency,
    Quantity:
      line.quantity == null ? "" : exactSignedDecimal(line.quantity, "quantity"),
    Unit: safe(line.unit),
    "Unit Rate":
      line.unitRate == null ? "" : exactSignedDecimal(line.unitRate, "unitRate"),
    Notes: safe(line.notes),
    "Original Budget": exactSignedDecimal(data.snapshot.originalTotal),
    "Current Budget": exactSignedDecimal(data.snapshot.currentTotal),
    "Difference from Original": exactSignedDecimal(
      data.snapshot.differenceFromOriginal,
    ),
  }));
  const wb = XLSX.utils.book_new(),
    lines = XLSX.utils.json_to_sheet(rows),
    info = XLSX.utils.aoa_to_sheet([
      ["Approved Budget Baseline"],
      ["Project", safe(data.project.name)],
      ["Project Code", safe(data.project.code)],
      ["Company", safe(data.project.companyName)],
      ["Budget Version", data.snapshot.budgetVersion],
      ["Status", "Approved"],
      ["Currency", data.snapshot.currency],
      ["Original Budget", data.snapshot.originalTotal],
      ["Current Budget", data.snapshot.currentTotal],
      ["Difference from Original", data.snapshot.differenceFromOriginal],
      ["Approved By", safe(data.snapshot.approvedByName)],
      ["Approved At", data.snapshot.approvedAt],
      ["Approval Limit", data.snapshot.approvalLimit],
      ["Content Fingerprint", data.snapshot.contentFingerprint],
      ["Snapshot Fingerprint", data.snapshot.snapshotFingerprint],
      ["Generated At", data.generatedAt],
      [
        "Boundary",
        "Operational budget only; no accounting actuals, payments, commitments, forecasts, or cash disbursements.",
      ],
    ]),
    exactNumericCell = (value: string) => ({
      t: "n" as const,
      v: exactSignedDecimal(value) as unknown as number,
      z: "0.######",
    });
  data.snapshot.lines.forEach((line, index) => {
    const row = index + 2;
    lines[`E${row}`] = exactNumericCell(line.amount);
    if (line.quantity != null)
      lines[`G${row}`] = exactNumericCell(line.quantity);
    if (line.unitRate != null)
      lines[`I${row}`] = exactNumericCell(line.unitRate);
    lines[`K${row}`] = exactNumericCell(data.snapshot.originalTotal);
    lines[`L${row}`] = exactNumericCell(data.snapshot.currentTotal);
    lines[`M${row}`] = exactNumericCell(data.snapshot.differenceFromOriginal);
  });
  info.B8 = exactNumericCell(data.snapshot.originalTotal);
  info.B9 = exactNumericCell(data.snapshot.currentTotal);
  info.B10 = exactNumericCell(data.snapshot.differenceFromOriginal);
  info.B13 = exactNumericCell(data.snapshot.approvalLimit);
  lines["!autofilter"] = { ref: lines["!ref"] ?? "A1:M1" };
  lines["!freeze"] = { xSplit: 0, ySplit: 1 };
  lines["!cols"] = [
    { wch: 24 },
    { wch: 16 },
    { wch: 28 },
    { wch: 40 },
    { wch: 16 },
    { wch: 10 },
    { wch: 12 },
    { wch: 10 },
    { wch: 14 },
    { wch: 30 },
    { wch: 18 },
    { wch: 18 },
    { wch: 22 },
  ];
  (lines as any)["!pageSetup"] = { orientation: "landscape", fitToWidth: 1 };
  XLSX.utils.book_append_sheet(wb, lines, "Budget Lines");
  XLSX.utils.book_append_sheet(wb, info, "Export Information");
  wb.Workbook = { ...(wb.Workbook ?? {}), Views: [{ RTL: false }] };
  const output: Buffer = XLSX.write(wb, {
    type: "buffer",
    bookType: "xlsx",
    compression: true,
  });
  // SheetJS Community writes native cells and filters but does not serialize
  // frozen panes. Add the standards-defined pane node without adding formulas
  // or external relationships.
  const zip = new AdmZip(output);
  const sheetEntry = zip.getEntry("xl/worksheets/sheet1.xml");
  if (!sheetEntry)
    throw new FinancialControlError(
      500,
      "BUDGET_EXPORT_SHEET_MISSING",
      "Budget worksheet could not be finalized.",
    );
  const xml = sheetEntry
    .getData()
    .toString("utf8")
    .replace(
      /(<sheetView[^>]*>)/,
      '$1<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>',
    );
  zip.updateFile("xl/worksheets/sheet1.xml", Buffer.from(xml, "utf8"));
  return zip.toBuffer();
}
