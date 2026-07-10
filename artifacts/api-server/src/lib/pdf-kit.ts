// Shared PDF rendering helpers — the single source of truth for every BIMLog
// report. No report should hand-roll its own header/footer/table/fingerprint
// code; they must all consume these helpers so the platform stays consistent.
//
// Design contract (BIMLog Quality Standard):
//   - navy section header bars (#1E3A5F), white content, light-grey alternating
//     rows (#F8FAFC), black text — no priority/status color badges anywhere;
//   - cover page for formal documents, branded running header for logs;
//   - page numbers "Page X of Y" via bufferedPageRange + switchToPage;
//   - canonical footer "BIMLog by IgniteSmart" with timestamp + report number;
//   - SHA-256 fingerprint of the DATA SNAPSHOT (not rendered bytes) on the last
//     page.
import { createHash } from "crypto";
import PDFDocument from "pdfkit";

type Doc = PDFKit.PDFDocument;
type PdfDocumentOptions = ConstructorParameters<typeof PDFDocument>[0];

export function createPdfDocument(options: PdfDocumentOptions = {}): PDFKit.PDFDocument {
  return new PDFDocument(options);
}


// ── Palette / shared constants ──
export const PALETTE = {
  NAVY: "#1E3A5F",
  ROW_ALT: "#F8FAFC",
  TEXT: "#000000",
  MUTED: "#6B7280",
  BORDER: "#E5E7EB",
  LINE: "#D1D5DB",
  BAND: "#F4F6F8",
  WHITE: "#FFFFFF",
  FOOTER: "#9CA3AF",
  FONT: "Helvetica",
  FONT_BOLD: "Helvetica-Bold",
  MARGIN: 40,
} as const;

// ── Canonical terminology maps (platform-wide) ──
const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  follow_up: "Follow Up",
  waiting_design: "Waiting Design",
  approved: "Approved",
  resolved: "Resolved",
};

const PRIORITY_LABEL: Record<number, string> = {
  1: "P1 Critical",
  2: "P2 High",
  3: "P3 Medium",
  4: "P4 Low",
  5: "P5 Monitor",
};

/** Canonical human label for a status code. Unknown codes pass through. */
export function statusText(status: string | null | undefined): string {
  if (!status) return "—";
  return STATUS_LABEL[status] ?? status;
}

/** Canonical human label for a numeric priority (1-5). */
export function priorityText(priority: number | null | undefined): string {
  if (!priority) return "—";
  return PRIORITY_LABEL[priority] ?? `P${priority}`;
}

/**
 * SHA-256 of a DATA SNAPSHOT (not the rendered PDF bytes). Callers pass the
 * structured payload that defines the report's content; key/insertion order is
 * preserved by JSON.stringify so the same data always yields the same hash.
 */
export function computeContentHash(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

// ── Cover page ──
export interface CoverPageOptions {
  margin?: number;
  logoBase64?: Buffer | null;
  logoType?: "png" | "jpeg" | null;
  companyName: string;
  reportTitle: string;
  reportSubtitle?: string;
  reportNumber: string;
  reportDate: Date;
  preparedBy?: string;
  submittedTo?: string;
  /** Optional extra right-aligned line under the date row (e.g. "Issued to: X"). */
  issuedTo?: string;
  isoStamp?: boolean;
  projectName: string;
  projectAddress?: string;
  /** One-line meta under the project name, e.g. "Project Code: X | Total: N". */
  projectMeta?: string;
}

const fmtLongDate = (d: Date) =>
  d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

/**
 * Navy cover band + light-grey project info band. Returns the Y coordinate at
 * the bottom of the info band so callers can lay out report-specific summary
 * content below it.
 */
export function drawCoverPage(doc: Doc, o: CoverPageOptions): number {
  const M = o.margin ?? PALETTE.MARGIN;
  const W = doc.page.width;
  const CW = W - M * 2;
  const isoStamp = o.isoStamp !== false;

  // Navy header band
  const headerBandH = 148;
  const projectBandY = headerBandH;
  doc.rect(0, 0, W, headerBandH).fill(PALETTE.NAVY);
  if (o.logoBase64 && o.logoType) {
    try {
      doc.image(o.logoBase64, M, 15, { height: 50, fit: [120, 50] });
      doc.fontSize(18).font(PALETTE.FONT_BOLD).fillColor("white").text(o.companyName, M + 130, 22);
    } catch {
      doc.fontSize(26).font(PALETTE.FONT_BOLD).fillColor("white").text(o.companyName, M, 20);
    }
  } else {
    doc.fontSize(26).font(PALETTE.FONT_BOLD).fillColor("white").text(o.companyName, M, 20);
  }
  const rightBlockW = 170;
  const rightBlockX = W - M - rightBlockW;
  const rightTextInset = 10;
  doc.fontSize(11).font(PALETTE.FONT_BOLD).fillColor("white")
    .text(o.reportTitle, rightBlockX, 16, { align: "left", width: rightBlockW, lineBreak: false });
  if (o.reportSubtitle) {
    doc.fontSize(8).font(PALETTE.FONT).fillColor("#D1D5DB")
      .text(o.reportSubtitle, rightBlockX, 32, { align: "left", width: rightBlockW, lineBreak: false });
  }

  // ISO 19650 compliance stamp shares the same left and right edge as the report title block.
  if (isoStamp) {
    const isoY = 54;
    doc.rect(rightBlockX, isoY, rightBlockW, 30).lineWidth(1).stroke("#FFFFFF");
    doc.fontSize(8).font(PALETTE.FONT_BOLD).fillColor("white")
      .text("ISO 19650", rightBlockX + rightTextInset, isoY + 7, { width: rightBlockW - rightTextInset * 2, align: "center", lineBreak: false });
    doc.fontSize(7).font(PALETTE.FONT).fillColor("white")
      .text("COMPLIANT", rightBlockX + rightTextInset, isoY + 18, { width: rightBlockW - rightTextInset * 2, align: "center", lineBreak: false });
  }
  doc.moveTo(M, 92).lineTo(W - M, 92).strokeColor("#FFFFFF").lineWidth(0.5).stroke();
  doc.fontSize(10).font(PALETTE.FONT_BOLD).fillColor("white").text(`Report No: ${o.reportNumber}`, M, 100);
  doc.fontSize(9).font(PALETTE.FONT).fillColor("white").text(`Date: ${fmtLongDate(o.reportDate)}`, M, 114);
  doc.fontSize(9).font(PALETTE.FONT).fillColor("white").text(`Prepared by: ${o.preparedBy ?? ""}`, M, 128);
  if (o.submittedTo) {
    doc.fontSize(9).font(PALETTE.FONT).fillColor("white").text(`Submitted to: ${o.submittedTo}`, M + CW / 2, 114, { width: CW / 2, align: "left" });
  }
  if (o.issuedTo) {
    doc.fontSize(9).font(PALETTE.FONT_BOLD).fillColor("white").text(o.issuedTo, M + CW / 2, 128, { width: CW / 2, align: "left" });
  }

  // Project info band (neutral light grey)
  const address = o.projectAddress?.trim() ? o.projectAddress.trim() : "";
  const bandH = address ? 58 : 48;
  doc.rect(0, projectBandY, W, bandH).fill(PALETTE.BAND);
  doc.fontSize(18).font(PALETTE.FONT_BOLD).fillColor(PALETTE.NAVY).text(o.projectName, M, projectBandY + 8);
  let infoY = projectBandY + 30;
  if (address) {
    doc.fontSize(9).font(PALETTE.FONT).fillColor(PALETTE.MUTED).text(address, M, infoY, { width: CW });
    infoY += 14;
  }
  if (o.projectMeta) {
    doc.fontSize(10).font(PALETTE.FONT).fillColor(PALETTE.MUTED).text(o.projectMeta, M, infoY);
  }

  return projectBandY + bandH;
}

// ── Branded running header (for log-style reports) ──
export interface BrandedHeaderOptions {
  margin?: number;
  logoBase64?: Buffer | null;
  logoType?: "png" | "jpeg" | null;
  companyName: string;
  title: string;
  subtitle?: string;
  projectName: string;
  projectCode?: string;
  reportNumber?: string;
  reportDate?: Date;
}

/**
 * Compact navy running header for logs (RFI Log, Submittal Log, etc.). Returns
 * the Y coordinate just below the header so the table can start there.
 */
export function drawBrandedHeader(doc: Doc, o: BrandedHeaderOptions): number {
  const M = o.margin ?? PALETTE.MARGIN;
  const W = doc.page.width;
  const CW = W - M * 2;
  const bandH = 58;

  doc.rect(0, 0, W, bandH).fill(PALETTE.NAVY);
  if (o.logoBase64 && o.logoType) {
    try {
      doc.image(o.logoBase64, M, 10, { height: 36, fit: [110, 36] });
      doc.fontSize(14).font(PALETTE.FONT_BOLD).fillColor("white").text(o.companyName, M + 120, 14);
    } catch {
      doc.fontSize(16).font(PALETTE.FONT_BOLD).fillColor("white").text(o.companyName, M, 14);
    }
  } else {
    doc.fontSize(16).font(PALETTE.FONT_BOLD).fillColor("white").text(o.companyName, M, 14);
  }
  doc.fontSize(13).font(PALETTE.FONT_BOLD).fillColor("white").text(o.title, M, 12, { align: "right", width: CW });
  const projLine = [o.projectName, o.projectCode ? `(${o.projectCode})` : ""].filter(Boolean).join(" ");
  doc.fontSize(8).font(PALETTE.FONT).fillColor("#D1D5DB").text(projLine, M, 38, { width: CW * 0.6 });
  if (o.reportNumber) {
    doc.fontSize(8).font(PALETTE.FONT).fillColor("#D1D5DB").text(o.reportNumber, M, 38, { align: "right", width: CW });
  }
  return bandH + 6;
}

// ── Section bar ──
export interface SectionBarOptions {
  margin?: number;
  fontSize?: number;
}

/** Navy section-header bar. Returns the Y just below it (y + 26). */
export function sectionBar(doc: Doc, label: string, y: number, o: SectionBarOptions = {}): number {
  const M = o.margin ?? PALETTE.MARGIN;
  const W = doc.page.width;
  const CW = W - M * 2;
  doc.rect(M, y, CW, 20).fill(PALETTE.NAVY);
  doc.fontSize(o.fontSize ?? 11).font(PALETTE.FONT_BOLD).fillColor("white").text(label, M + 8, y + 5.5, { width: CW - 16 });
  return y + 26;
}

// ── Watermark ──
export interface WatermarkOptions {
  margin?: number;
  angle?: number;
  fontSize?: number;
  color?: string;
  opacity?: number;
}

/** Diagonal watermark across the CURRENT page (DRAFT / ISSUED / SUPERSEDED). */
export function drawWatermark(doc: Doc, text: string, o: WatermarkOptions = {}): void {
  const W = doc.page.width;
  const H = doc.page.height;
  doc.save();
  doc.rotate(o.angle ?? -30, { origin: [W / 2, H / 2] });
  doc.fontSize(o.fontSize ?? 72).font(PALETTE.FONT_BOLD).fillColor(o.color ?? PALETTE.NAVY).fillOpacity(o.opacity ?? 0.07)
    .text(text, 0, H / 2 - 50, { width: W, align: "center" });
  doc.restore();
  doc.fillOpacity(1);
}

// ── Fingerprint ──
export interface FingerprintOptions {
  margin?: number;
  y?: number;
  fontSize?: number;
  color?: string;
}

/** SHA-256 fingerprint line. Call on the LAST page, above the footer. */
export function appendFingerprint(doc: Doc, contentHash: string, o: FingerprintOptions = {}): void {
  const M = o.margin ?? PALETTE.MARGIN;
  const W = doc.page.width;
  const CW = W - M * 2;
  doc.fontSize(o.fontSize ?? 6.5).font(PALETTE.FONT).fillColor(o.color ?? PALETTE.FOOTER)
    .text(`Document SHA-256: ${contentHash}`, M, o.y ?? 548, { width: CW, align: "center", lineBreak: false });
}

// ── Footer ──
export interface FooterOptions {
  margin?: number;
  y?: number;
  fontSize?: number;
  color?: string;
  companyName?: string;
  projectName?: string;
  reportNumber?: string;
  timestamp?: string;
  pageLabel?: string;
}

/**
 * Canonical footer line for the CURRENT page. Always ends with the platform
 * signature "BIMLog by IgniteSmart". Page numbering is supplied via pageLabel
 * (use addPageNumbers to stamp the whole document).
 */
export function drawFooter(doc: Doc, o: FooterOptions = {}): void {
  const M = o.margin ?? PALETTE.MARGIN;
  const W = doc.page.width;
  const CW = W - M * 2;
  const parts = [o.companyName, o.projectName, o.reportNumber, o.timestamp, o.pageLabel]
    .map((p) => (p ? String(p).trim() : ""))
    .filter(Boolean);
  parts.push("BIMLog by IgniteSmart");
  doc.fontSize(o.fontSize ?? 7).font(PALETTE.FONT).fillColor(o.color ?? PALETTE.FOOTER)
    .text(parts.join(" | "), M, o.y ?? 560, { align: "center", width: CW, lineBreak: false });
}

// ── Page numbering + per-page chrome ──
export interface PageNumberOptions {
  margin?: number;
  footerY?: number;
  fingerprintY?: number;
  /** When set, stamps this watermark on every page. */
  watermarkText?: string;
  /** When set, stamps the SHA-256 fingerprint on the last page. */
  contentHash?: string;
  companyName?: string;
  projectName?: string;
  reportNumber?: string;
  timestamp?: string;
}

/**
 * Walks every buffered page (bufferedPageRange + switchToPage) and stamps the
 * canonical footer with "Page X of Y". Optionally stamps a watermark on every
 * page and the SHA-256 fingerprint on the last page. Call this LAST, after all
 * content has been written, because it depends on the final page count.
 */
export function addPageNumbers(doc: Doc, o: PageNumberOptions = {}): void {
  const M = o.margin ?? PALETTE.MARGIN;
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    if (o.watermarkText) drawWatermark(doc, o.watermarkText, { margin: M });
    if (o.contentHash && i === range.count - 1) {
      appendFingerprint(doc, o.contentHash, { margin: M, y: o.fingerprintY });
    }
    drawFooter(doc, {
      margin: M,
      y: o.footerY,
      companyName: o.companyName,
      projectName: o.projectName,
      reportNumber: o.reportNumber,
      timestamp: o.timestamp,
      pageLabel: `Page ${i + 1} of ${range.count}`,
    });
  }
  doc.flushPages();
}

// ── Table (the workhorse) ──
export interface TableColumn {
  label: string;
  width: number;
  align?: "left" | "center" | "right";
  bold?: boolean;
  /** Wrap (multi-line) instead of single-line ellipsis. Drives row height. */
  wrap?: boolean;
  color?: string;
  /** Render the cell text for a given row. Falls back to row[key] / "—". */
  format?: (row: any, index: number) => string;
  key?: string;
}

export interface DrawTableOptions {
  x: number;
  startY: number;
  columns: TableColumn[];
  rows: any[];
  fontSize?: number;
  headerFontSize?: number;
  rowMinHeight?: number;
  headerHeight?: number;
  cellPadX?: number;
  cellPadY?: number;
  /** Y limit; a row that would cross it triggers a page break. */
  pageBottom: number;
  headerFill?: string;
  rowAltFill?: string;
  textColor?: string;
  borderColor?: string;
  /**
   * Called on page break BEFORE the table header is redrawn. Implementations
   * should addPage and draw any running chrome, then return the Y at which the
   * new table header should start.
   */
  onPageBreak?: () => number;
}

/**
 * Fixed-width table: navy header (repeated after page breaks), alternating
 * light-grey rows, black text. Single-line columns ellipsis-truncate so text
 * never wraps mid-word; columns flagged `wrap` expand the row height. Returns
 * the Y coordinate just below the last row.
 */
export function drawTable(doc: Doc, o: DrawTableOptions): number {
  const columns = o.columns;
  const tableW = columns.reduce((s, c) => s + c.width, 0);
  const fontSize = o.fontSize ?? 7;
  const headerFontSize = o.headerFontSize ?? 7;
  const rowMinHeight = o.rowMinHeight ?? 24;
  const headerHeight = o.headerHeight ?? 18;
  const padX = o.cellPadX ?? 3;
  const padY = o.cellPadY ?? 5;
  const headerFill = o.headerFill ?? PALETTE.NAVY;
  const rowAltFill = o.rowAltFill ?? PALETTE.ROW_ALT;
  const textColor = o.textColor ?? PALETTE.TEXT;
  const borderColor = o.borderColor ?? PALETTE.BORDER;

  const cellText = (col: TableColumn, row: any, idx: number): string => {
    if (col.format) return col.format(row, idx);
    const v = col.key ? row[col.key] : undefined;
    return v === null || v === undefined || v === "" ? "—" : String(v);
  };

  const drawHeader = (hy: number): number => {
    doc.rect(o.x, hy, tableW, headerHeight).fill(headerFill);
    let cx = o.x;
    for (const col of columns) {
      doc.fontSize(headerFontSize).font(PALETTE.FONT_BOLD).fillColor("white")
        .text(col.label.toUpperCase(), cx + padX, hy + 5, { width: col.width - padX * 2, lineBreak: false });
      cx += col.width;
    }
    return hy + headerHeight + 2;
  };

  let y = drawHeader(o.startY);

  o.rows.forEach((row, idx) => {
    // Row height is driven by any wrapping columns.
    let wrapH = 0;
    for (const col of columns) {
      if (!col.wrap) continue;
      doc.fontSize(fontSize).font(col.bold ? PALETTE.FONT_BOLD : PALETTE.FONT);
      wrapH = Math.max(wrapH, doc.heightOfString(cellText(col, row, idx), { width: col.width - padX * 2 }));
    }
    const rowH = wrapH > 0 ? Math.max(rowMinHeight, wrapH + padY + 3) : rowMinHeight;

    if (y + rowH > o.pageBottom) {
      y = o.onPageBreak ? o.onPageBreak() : (doc.addPage(), o.startY);
      y = drawHeader(y);
    }

    doc.rect(o.x, y, tableW, rowH).fill(idx % 2 === 0 ? PALETTE.WHITE : rowAltFill);
    let cx = o.x;
    for (const col of columns) {
      const text = cellText(col, row, idx);
      doc.fontSize(fontSize).font(col.bold ? PALETTE.FONT_BOLD : PALETTE.FONT).fillColor(col.color ?? textColor);
      if (col.wrap) {
        doc.text(text, cx + padX, y + padY, { width: col.width - padX * 2 });
      } else {
        doc.text(text, cx + padX, y + padY, {
          width: col.width - padX * 2,
          height: rowH - padY - 1,
          align: col.align ?? "left",
          ellipsis: true,
          lineBreak: false,
        });
      }
      cx += col.width;
    }
    doc.rect(o.x, y, tableW, rowH).stroke(borderColor);
    y += rowH;
  });

  return y;
}
