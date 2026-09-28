import crypto from "node:crypto";

export type ReportLayoutSettings = { pageSize: "A4" | "LETTER"; orientation: "portrait" | "landscape"; marginMm: number; header: string; footer: string; rowsPerPage: number };
export type ReportLayoutRow = { key: string; cells: readonly string[]; screenshot?: { width: number; height: number; alt: string } };

export function layoutProfessionalReport(rows: readonly ReportLayoutRow[], settings: ReportLayoutSettings) {
  if (!settings.header.trim() || !settings.footer.trim()) throw new Error("REPORT_LAYOUT_HEADER_FOOTER_REQUIRED");
  if (settings.marginMm < 8 || settings.marginMm > 30 || settings.rowsPerPage < 1) throw new Error("REPORT_LAYOUT_SETTINGS_INVALID");
  const normalized = rows.map(row => ({
    ...row,
    cells: row.cells.map(cell => cell.trim()),
    screenshot: row.screenshot ? { ...row.screenshot, fit: "contain" as const, maxWidthPercent: 100, alt: row.screenshot.alt.trim() } : undefined,
  }));
  const pages = Array.from({ length: Math.ceil(normalized.length / settings.rowsPerPage) }, (_, index) => ({
    pageNumber: index + 1,
    header: settings.header,
    footer: settings.footer,
    rows: normalized.slice(index * settings.rowsPerPage, (index + 1) * settings.rowsPerPage),
  })).filter(page => page.rows.length > 0);
  const model = { settings, pages };
  return { ...model, layoutFingerprint: crypto.createHash("sha256").update(JSON.stringify(model)).digest("hex") };
}
