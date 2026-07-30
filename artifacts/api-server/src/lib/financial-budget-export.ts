import * as XLSX from "xlsx";
import { canonicalSpreadsheetWriteOptions } from "@workspace/api-zod";
import AdmZip from "adm-zip";
import { createHash } from "crypto";
import { FinancialControlError } from "./financial-control-contract";
import { exactSignedDecimal } from "./financial-budget-contract";
import { createPdfDocument } from "./pdf-kit";

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

export type BudgetCurrentViewExport = {
  project: { name: string; code: string; companyName: string };
  generatedAt: string;
  generatedBy: string;
  reportTitle: string;
  reportNumber: string;
  view: "structure" | "budget" | "history" | "snapshot";
  language: "en" | "es";
  filters: string[];
  totals: Array<{ label: string; value: string }>;
  sections: Array<{
    title: string;
    emptyLabel: string;
    columns: string[];
    rows: string[][];
  }>;
  hashPayload: unknown;
};

export function budgetCurrentViewFileName(data: Pick<BudgetCurrentViewExport, "view" | "project" | "language">) {
  const title = data.language === "es" ? "presupuesto-vista-actual" : "budget-current-view";
  const view = safe(data.view).replace(/[^A-Za-z0-9]+/g, "-");
  const code = safe(data.project.code).replace(/[^A-Za-z0-9]+/g, "-");
  return `${title}-${view}-${code}.pdf`.replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export async function buildBudgetCurrentViewPdf(data: BudgetCurrentViewExport): Promise<Buffer> {
  const doc = createPdfDocument({
      size: "LETTER",
      layout: "landscape",
      margin: 40,
      bufferPages: true,
      info: {
        Title: safe(data.reportTitle),
        Author: "BIMLog",
        Subject: "Budget current-view export",
      },
    }),
    chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  const contentHash = createHash("sha256").update(JSON.stringify(data.hashPayload)).digest("hex");
  const width = doc.page.width - 80;
  const chrome = {
    generated: data.language === "es" ? "Generado" : "Generated",
    by: data.language === "es" ? "Por" : "By",
    reportNo: data.language === "es" ? "Reporte No." : "Report No.",
    fingerprint: data.language === "es" ? "Huella SHA-256" : "SHA-256 fingerprint",
    page: data.language === "es" ? "Pagina" : "Page",
    of: data.language === "es" ? "de" : "of",
  };
  const drawHeader = () => {
    doc.rect(0, 0, doc.page.width, 58).fill("#1E3A5F");
    doc.fillColor("#FFFFFF").fontSize(16).font("Helvetica-Bold").text("BIMLog", 40, 14, { width: 180 });
    doc.fontSize(13).text(safe(data.reportTitle), 260, 14, { width: doc.page.width - 300, align: "right" });
    doc.fontSize(8).font("Helvetica").text(`${safe(data.project.name)} (${safe(data.project.code)})`, 260, 34, { width: doc.page.width - 300, align: "right" });
    doc.fillColor("#000000");
    return 74;
  };
  let y = drawHeader();
  doc.fontSize(10).font("Helvetica").text(`${safe(data.project.companyName)} | ${chrome.generated}: ${safe(data.generatedAt)} | ${chrome.by}: ${safe(data.generatedBy)}`, 40, y, { width });
  y += 16;
  doc.fontSize(8).fillColor("#5B6572").text(data.filters.map(safe).join(" | "), 40, y, { width, lineGap: 2 });
  y = doc.y + 12;
  const cardWidth = Math.min(170, (width - 24) / Math.max(1, data.totals.length));
  data.totals.forEach((card, index) => {
    const x = 40 + index * (cardWidth + 8);
    doc.rect(x, y, cardWidth, 42).stroke("#D1D5DB");
    doc.fontSize(7).font("Helvetica-Bold").fillColor("#5B6572").text(safe(card.label).toUpperCase(), x + 7, y + 8, { width: cardWidth - 14 });
    doc.fontSize(12).fillColor("#000000").text(safe(card.value), x + 7, y + 22, { width: cardWidth - 14 });
  });
  y += data.totals.length ? 58 : 8;
  for (const section of data.sections) {
    if (y > 500) {
      doc.addPage();
      y = drawHeader();
    }
    doc.fontSize(12).font("Helvetica-Bold").fillColor("#1E3A5F").text(safe(section.title), 40, y);
    y += 18;
    if (!section.rows.length) {
      doc.fontSize(9).font("Helvetica").fillColor("#5B6572").text(safe(section.emptyLabel), 40, y, { width });
      y = doc.y + 16;
      continue;
    }
    const colWidth = width / section.columns.length;
    doc.rect(40, y, width, 18).fill("#EEF3F8");
    section.columns.forEach((column, index) => {
      doc.fillColor("#000000").fontSize(7).font("Helvetica-Bold").text(safe(column), 44 + index * colWidth, y + 5, { width: colWidth - 8, lineBreak: false, ellipsis: true });
    });
    y += 18;
    section.rows.forEach((row, rowIndex) => {
      const rowHeight = 26;
      if (y + rowHeight > 540) {
        doc.addPage();
        y = drawHeader();
      }
      if (rowIndex % 2) doc.rect(40, y, width, rowHeight).fill("#F8FAFC");
      row.forEach((value, index) => {
        doc.fillColor("#000000").fontSize(7).font("Helvetica").text(safe(value), 44 + index * colWidth, y + 5, { width: colWidth - 8, height: rowHeight - 8, ellipsis: true });
      });
      doc.rect(40, y, width, rowHeight).stroke("#E5E7EB");
      y += rowHeight;
    });
    y += 16;
  }
  if (y > 500) {
    doc.addPage();
    y = drawHeader();
  }
  doc.fontSize(8).fillColor("#5B6572").text(`${chrome.reportNo}: ${safe(data.reportNumber)}`, 40, Math.max(y, 500), { width });
  doc.text(`${chrome.fingerprint}: ${contentHash}`, 40, doc.y + 4, { width });
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    doc.fontSize(8).fillColor("#6B7280").text(`BIMLog by IgniteSmart | ${safe(data.reportNumber)} | ${chrome.page} ${i + 1} ${chrome.of} ${range.count}`, 40, 558, { width, align: "center" });
  }
  doc.end();
  return new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

export async function buildBaselinePdf(data: BaselineExport): Promise<Buffer> {
  const doc = createPdfDocument({
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
    lines = XLSX.utils.json_to_sheet(rows, canonicalSpreadsheetWriteOptions({})),
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
    ], canonicalSpreadsheetWriteOptions({})),
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
  const output: Buffer = XLSX.write(wb, canonicalSpreadsheetWriteOptions({
    type: "buffer",
    bookType: "xlsx",
    compression: true,
  }));
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
