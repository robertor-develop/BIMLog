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

export type ReportModule = "rfi" | "schedule" | "lens" | "clash" | "submittal" | "transmittal" | "change_order" | "meeting" | "files" | "platform";

export function createPdfDocument(options: PdfDocumentOptions = {}): PDFKit.PDFDocument {
  const doc = new PDFDocument(options);
  const nativeAddPage = doc.addPage.bind(doc);

  // PDFKit retains mutable cursor and page-option state between pages. That is
  // convenient for prose, but unsafe for governed reports: an implicit
  // continuation page can otherwise inherit a stale cursor or fall back to a
  // different physical layout. Preserve the exact current MediaBox/margins and
  // reset the content origin whenever a caller requests an implicit page.
  doc.addPage = ((pageOptions?: PDFKit.PDFDocumentOptions) => {
    const currentPage = doc.page;
    const continuationOptions = !pageOptions && currentPage
      ? {
          size: [currentPage.width, currentPage.height] as [number, number],
          margins: {
            top: currentPage.margins.top,
            right: currentPage.margins.right,
            bottom: currentPage.margins.bottom,
            left: currentPage.margins.left,
          },
        }
      : pageOptions;
    const result = nativeAddPage(continuationOptions);
    doc.x = doc.page.margins.left;
    doc.y = doc.page.margins.top;
    return result;
  }) as typeof doc.addPage;

  return doc;
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

function fitSingleLineFontSize(
  doc: Doc,
  text: string,
  width: number,
  preferred: number,
  minimum: number,
  font: string = PALETTE.FONT,
): number {
  let size = preferred;
  doc.font(font);
  while (size > minimum) {
    doc.fontSize(size);
    if (doc.widthOfString(text) <= width) break;
    size = Math.max(minimum, size - 0.5);
  }
  return size;
}

function fitWrappedFontSize(
  doc: Doc,
  text: string,
  width: number,
  height: number,
  preferred: number,
  minimum: number,
  font: string = PALETTE.FONT,
): number {
  let size = preferred;
  doc.font(font);
  while (size > minimum) {
    doc.fontSize(size);
    if (doc.heightOfString(text, { width }) <= height) break;
    size = Math.max(minimum, size - 0.5);
  }
  return size;
}

export interface ReportTheme {
  module: ReportModule;
  variant: string;
  primary: string;
  dark: string;
  light: string;
  pattern: "solid" | "rule" | "double-rule" | "grid" | "dots";
}

const family = (module: ReportModule, primary: string, dark: string, light: string) =>
  (variant: string, pattern: ReportTheme["pattern"]): ReportTheme => ({ module, variant, primary, dark, light, pattern });

const rfi = family("rfi", "#2563A6", "#173F6B", "#EAF2FA");
const schedule = family("schedule", "#277DA1", "#164E63", "#E7F3F7");
const lens = family("lens", "#315C9B", "#1E3A5F", "#EBF0F8");
const clash = family("clash", "#2F648F", "#183F5B", "#E9F2F7");
const submittal = family("submittal", "#3B6EA8", "#234B78", "#ECF3FA");
const reserved = (module: ReportModule, primary: string) => family(module, primary, PALETTE.NAVY, "#EEF4FA");

/** Central report theme registry. Routes select a named variant; they never invent colors. */
export const REPORT_THEMES = {
  rfi: { detail: rfi("RFI PDF", "solid"), word: rfi("RFI DOCX", "rule"), audit: rfi("RFI Audit", "double-rule"), list: rfi("RFI List", "rule"), log: rfi("RFI Log", "grid") },
  schedule: { calendar: schedule("Schedule Calendar", "grid"), board: schedule("Schedule Board", "dots"), list: schedule("Schedule List", "rule") },
  lens: { coordination: lens("Lens Coordination", "solid"), register: lens("Lens Register", "grid"), audit: lens("Lens Audit", "double-rule") },
  clash: { coordination: clash("Clash Coordination", "solid"), register: clash("Clash Register", "grid") },
  submittal: { detail: submittal("Submittal PDF", "solid"), log: submittal("Submittal Log", "rule"), tracker: submittal("Shop Drawing Control", "grid"), audit: submittal("Submittal Audit", "double-rule") },
  transmittal: { detail: reserved("transmittal", "#356FA3")("Transmittal", "rule"), log: reserved("transmittal", "#356FA3")("Transmittal Log", "grid") },
  changeOrder: { detail: reserved("change_order", "#2F6690")("Change Order", "double-rule"), log: reserved("change_order", "#2F6690")("Change Order Log", "grid") },
  meeting: { minutes: reserved("meeting", "#4078A8")("Meeting Minutes", "dots"), log: reserved("meeting", "#4078A8")("Meeting Minutes Log", "grid") },
  files: { register: reserved("files", "#4A6FA5")("Files Register", "grid"), response: reserved("files", "#4A6FA5")("Official Response", "rule"), compliance: reserved("files", "#4A6FA5")("Naming Compliance", "double-rule"), cvr: reserved("files", "#4A6FA5")("Content Verification", "grid"), audit: reserved("files", "#4A6FA5")("Document Audit", "double-rule") },
  platform: {
    standard: reserved("platform", PALETTE.NAVY)("Platform Report", "solid"),
    health: reserved("platform", "#365F8D")("Project Health", "solid"),
    performance: reserved("platform", "#365F8D")("Project Performance", "rule"),
    dispute: reserved("platform", "#365F8D")("Dispute Evidence", "double-rule"),
  },
} as const;

export function reportFileName(title: string): string {
  return `${title.trim().replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "")}.pdf`;
}

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
  theme?: ReportTheme;
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
  const headerBandH = 96;
  const projectBandY = headerBandH;
  const theme = o.theme ?? REPORT_THEMES.platform.standard;
  doc.rect(0, 0, W, headerBandH).fill(theme.dark);
  if (o.logoBase64 && o.logoType) {
    try {
      doc.image(o.logoBase64, M, 15, { height: 50, fit: [120, 50] });
      doc.fontSize(18).font(PALETTE.FONT_BOLD).fillColor("white").text(o.companyName, M + 130, 18, { width: CW - 450, lineBreak: false, ellipsis: true });
    } catch {
      doc.fontSize(20).font(PALETTE.FONT_BOLD).fillColor("white").text(o.companyName, M, 16, { width: CW - 330, lineBreak: false, ellipsis: true });
    }
  } else {
    doc.fontSize(20).font(PALETTE.FONT_BOLD).fillColor("white").text(o.companyName, M, 16, { width: CW - 330, lineBreak: false, ellipsis: true });
  }
  const rightBlockW = Math.min(320, CW * 0.48);
  const rightBlockX = W - M - rightBlockW;
  const rightTextInset = 10;
  const titleSize = o.reportTitle.length > 44 ? 9 : o.reportTitle.length > 32 ? 10 : 11;
  doc.fontSize(titleSize).font(PALETTE.FONT_BOLD).fillColor("white")
    .text(o.reportTitle, rightBlockX, 13, { align: "right", width: rightBlockW, height: 15, lineBreak: false, ellipsis: true });
  if (o.reportSubtitle) {
    doc.fontSize(8).font(PALETTE.FONT).fillColor("#D1D5DB")
      .text(o.reportSubtitle, rightBlockX, 30, { align: "right", width: rightBlockW, lineBreak: false, ellipsis: true });
  }

  // Compact ISO marker stays inside the metadata row without forcing a tall cover.
  if (isoStamp) {
    const isoW = 92;
    const isoX = W - M - isoW;
    const isoY = 53;
    doc.rect(isoX, isoY, isoW, 23).lineWidth(0.8).stroke("#FFFFFF");
    doc.fontSize(7).font(PALETTE.FONT_BOLD).fillColor("white")
      .text("ISO 19650", isoX + rightTextInset, isoY + 5, { width: isoW - rightTextInset * 2, align: "center", lineBreak: false });
    doc.fontSize(6).font(PALETTE.FONT).fillColor("white")
      .text("COMPLIANT", isoX + rightTextInset, isoY + 14, { width: isoW - rightTextInset * 2, align: "center", lineBreak: false });
  }
  doc.moveTo(M, 47).lineTo(W - M, 47).strokeColor("#FFFFFF").lineWidth(0.5).stroke();
  doc.fontSize(8).font(PALETTE.FONT_BOLD).fillColor("white").text(`Report No: ${o.reportNumber}`, M, 56, { width: CW * 0.32, lineBreak: false, ellipsis: true });
  doc.fontSize(8).font(PALETTE.FONT).fillColor("white").text(`Date: ${fmtLongDate(o.reportDate)}`, M, 70, { width: CW * 0.32, lineBreak: false });
  doc.fontSize(8).font(PALETTE.FONT).fillColor("white").text(`Prepared by: ${o.preparedBy ?? ""}`, M + CW * 0.34, 56, { width: CW * 0.34, lineBreak: false, ellipsis: true });
  if (o.submittedTo) {
    doc.fontSize(8).font(PALETTE.FONT).fillColor("white").text(`Submitted to: ${o.submittedTo}`, M + CW * 0.34, 70, { width: CW * 0.34, align: "left", lineBreak: false, ellipsis: true });
  }
  if (o.issuedTo) {
    doc.fontSize(8).font(PALETTE.FONT_BOLD).fillColor("white").text(o.issuedTo, M + CW * 0.69, 70, { width: CW * 0.17, align: "right", lineBreak: false, ellipsis: true });
  }

  // Project info band (neutral light grey)
  const address = o.projectAddress?.trim() ? o.projectAddress.trim() : "";
  const bandH = address ? 52 : 42;
  doc.rect(0, projectBandY, W, bandH).fill(PALETTE.BAND);
  doc.fontSize(15).font(PALETTE.FONT_BOLD).fillColor(theme.dark).text(o.projectName, M, projectBandY + 7, { width: CW, lineBreak: false, ellipsis: true });
  let infoY = projectBandY + 25;
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
  theme?: ReportTheme;
}

/**
 * Compact navy running header for logs (RFI Log, Submittal Log, etc.). Returns
 * the Y coordinate just below the header so the table can start there.
 */
export function drawBrandedHeader(doc: Doc, o: BrandedHeaderOptions): number {
  const M = o.margin ?? PALETTE.MARGIN;
  const W = doc.page.width;
  const CW = W - M * 2;
  const bandH = 60;

  const theme = o.theme ?? REPORT_THEMES.platform.standard;
  doc.rect(0, 0, W, bandH).fill(theme.dark);
  if (theme.pattern === "double-rule") doc.rect(0, bandH - 5, W, 2).fill(theme.primary);
  if (theme.pattern === "rule" || theme.pattern === "grid" || theme.pattern === "dots") doc.rect(0, bandH - 3, W, 3).fill(theme.primary);
  if (o.logoBase64 && o.logoType) {
    try {
      doc.image(o.logoBase64, M, 10, { height: 36, fit: [110, 36] });
      const companyWidth = Math.max(80, CW * 0.4 - 120);
      const companySize = fitSingleLineFontSize(doc, o.companyName, companyWidth, 16, 8, PALETTE.FONT_BOLD);
      doc.fontSize(companySize).font(PALETTE.FONT_BOLD).fillColor("white")
        .text(o.companyName, M + 120, 12, { width: companyWidth, lineBreak: false });
    } catch {
      const companyWidth = CW * 0.4;
      const companySize = fitSingleLineFontSize(doc, o.companyName, companyWidth, 16, 8, PALETTE.FONT_BOLD);
      doc.fontSize(companySize).font(PALETTE.FONT_BOLD).fillColor("white")
        .text(o.companyName, M, 12, { width: companyWidth, lineBreak: false });
    }
  } else {
    const companyWidth = CW * 0.4;
    const companySize = fitSingleLineFontSize(doc, o.companyName, companyWidth, 16, 8, PALETTE.FONT_BOLD);
    doc.fontSize(companySize).font(PALETTE.FONT_BOLD).fillColor("white")
      .text(o.companyName, M, 12, { width: companyWidth, lineBreak: false });
  }
  const titleX = M + CW * 0.43;
  const titleW = CW * 0.57;
  const titleH = 28;
  const titleSize = fitWrappedFontSize(doc, o.title, titleW, titleH, 13, 8, PALETTE.FONT_BOLD);
  doc.fontSize(titleSize).font(PALETTE.FONT_BOLD).fillColor("white")
    .text(o.title, titleX, 8, { align: "right", width: titleW, height: titleH, lineBreak: true });

  const projLine = [o.projectName, o.projectCode ? `(${o.projectCode})` : ""].filter(Boolean).join(" ");
  const projectWidth = CW * 0.4;
  const projectSize = fitSingleLineFontSize(doc, projLine, projectWidth, 8, 6.5);
  doc.fontSize(projectSize).font(PALETTE.FONT).fillColor("#D1D5DB")
    .text(projLine, M, 40, { width: projectWidth, lineBreak: false });

  const rightMeta = [o.subtitle, o.reportNumber].filter(Boolean).join(" | ");
  if (rightMeta) {
    const metaSize = fitSingleLineFontSize(doc, rightMeta, titleW, 7.5, 5.5);
    doc.fontSize(metaSize).font(PALETTE.FONT).fillColor("#D1D5DB")
      .text(rightMeta, titleX, 42, { align: "right", width: titleW, lineBreak: false });
  }
  return bandH + 6;
}

// ── Section bar ──
export interface SectionBarOptions {
  margin?: number;
  fontSize?: number;
  theme?: ReportTheme;
}

/** Navy section-header bar. Returns the Y just below it (y + 26). */
export function sectionBar(doc: Doc, label: string, y: number, o: SectionBarOptions = {}): number {
  const M = o.margin ?? PALETTE.MARGIN;
  const W = doc.page.width;
  const CW = W - M * 2;
  doc.rect(M, y, CW, 20).fill(o.theme?.primary ?? PALETTE.NAVY);
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
  const originalBottomMargin = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  try {
    doc.fontSize(o.fontSize ?? 6.5).font(PALETTE.FONT).fillColor(o.color ?? PALETTE.FOOTER)
      .text(`Document SHA-256: ${contentHash}`, M, o.y ?? 548, { width: CW, align: "center", lineBreak: false });
  } finally {
    doc.page.margins.bottom = originalBottomMargin;
  }
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
  const H = doc.page.height;
  const CW = W - M * 2;
  const left = [o.companyName, o.projectName].map((p) => (p ? String(p).trim() : "")).filter(Boolean).join(" | ");
  const center = [o.reportNumber, o.pageLabel].map((p) => (p ? String(p).trim() : "")).filter(Boolean).join(" | ");
  const right = [o.timestamp, "BIMLog by IgniteSmart"].map((p) => (p ? String(p).trim() : "")).filter(Boolean).join(" | ");
  const requestedY = o.y ?? H - 28;
  const footerY = Math.max(H - 40, Math.min(requestedY, H - 26));
  const gap = 8;
  const leftW = CW * 0.39;
  const centerW = CW * 0.22;
  const rightW = CW - leftW - centerW - gap * 2;
  const originalBottomMargin = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  try {
    doc.moveTo(M, footerY - 5).lineTo(W - M, footerY - 5).lineWidth(0.35).strokeColor(PALETTE.LINE).stroke();
    const preferred = o.fontSize ?? 6.5;
    const leftSize = fitSingleLineFontSize(doc, left, leftW, preferred, 5);
    doc.fontSize(leftSize).font(PALETTE.FONT).fillColor(o.color ?? PALETTE.FOOTER)
      .text(left, M, footerY, { width: leftW, lineBreak: false });
    const centerX = M + leftW + gap;
    const centerSize = fitSingleLineFontSize(doc, center, centerW, preferred, 5);
    doc.fontSize(centerSize).font(PALETTE.FONT).fillColor(o.color ?? PALETTE.FOOTER)
      .text(center, centerX, footerY, { width: centerW, align: "center", lineBreak: false });
    const rightX = centerX + centerW + gap;
    const rightSize = fitSingleLineFontSize(doc, right, rightW, preferred, 5);
    doc.fontSize(rightSize).font(PALETTE.FONT).fillColor(o.color ?? PALETTE.FOOTER)
      .text(right, rightX, footerY, { width: rightW, align: "right", lineBreak: false });
  } finally {
    doc.page.margins.bottom = originalBottomMargin;
  }
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
  const physicalRight = doc.page.width - doc.page.margins.right;
  if (o.x < doc.page.margins.left || o.x + tableW > physicalRight + 0.01) {
    const layoutError = new Error(
      `Governed table exceeds physical content bounds: x=${o.x}, width=${tableW}, `
      + `left=${doc.page.margins.left}, right=${physicalRight}`,
    );
    layoutError.name = "GovernedPdfLayoutError";
    throw layoutError;
  }
  const fontSize = o.fontSize ?? 7;
  const headerFontSize = o.headerFontSize ?? 7;
  const rowMinHeight = o.rowMinHeight ?? 24;
  const requestedHeaderHeight = o.headerHeight ?? 20;
  const padX = o.cellPadX ?? 3;
  const padY = o.cellPadY ?? 5;
  const headerFill = o.headerFill ?? PALETTE.NAVY;
  const rowAltFill = o.rowAltFill ?? PALETTE.ROW_ALT;
  const textColor = o.textColor ?? PALETTE.TEXT;
  const borderColor = o.borderColor ?? PALETTE.BORDER;
  const pageBottom = Math.min(o.pageBottom, doc.page.height - 42);

  let measuredHeaderTextHeight = 0;
  for (const col of columns) {
    doc.fontSize(headerFontSize).font(PALETTE.FONT_BOLD);
    measuredHeaderTextHeight = Math.max(
      measuredHeaderTextHeight,
      doc.heightOfString(col.label.toUpperCase(), { width: col.width - padX * 2 }),
    );
  }
  const headerHeight = Math.max(requestedHeaderHeight, measuredHeaderTextHeight + 8);

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
        .text(col.label.toUpperCase(), cx + padX, hy + 4, {
          width: col.width - padX * 2,
          height: headerHeight - 7,
          align: col.align ?? "left",
          lineBreak: true,
        });
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

    if (y + rowH > pageBottom) {
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
