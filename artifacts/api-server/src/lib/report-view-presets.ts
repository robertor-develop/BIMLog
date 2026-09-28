import crypto from "node:crypto";
import type { ReportProjectionRow } from "./report-view-pivots";

export const commonReportPresets = [
  { id: "common-open-rfis", dataset: "rfi", title: { en: "Open RFIs", es: "RFIs abiertos" }, filters: { status: ["open"] }, columns: ["number", "subject", "status", "responsibleCompany", "dueAt"] },
  { id: "common-submittal-review", dataset: "submittal", title: { en: "Submittals in review", es: "Submittals en revisión" }, filters: { status: ["under_review", "in_review"] }, columns: ["number", "title", "status", "reviewerCompany", "dueAt"] },
] as const;

export function currentViewExportModel(input: { rows: readonly ReportProjectionRow[]; visibleSourceKeys: readonly string[]; language: "en" | "es" }) {
  const allowed = new Set(input.visibleSourceKeys);
  const rows = input.rows.filter(row => allowed.has(`${row.dataset}:${row.recordId}:v${row.version}`)).map(row => ({ sourceKey: `${row.dataset}:${row.recordId}:v${row.version}`, status: row.status, company: row.company ?? "" }));
  const totals = { rows: rows.length, distinctRecords: new Set(rows.map(row => row.sourceKey)).size };
  const fingerprint = crypto.createHash("sha256").update(JSON.stringify({ rows, totals })).digest("hex");
  return { language: input.language, rows, totals, fingerprint };
}

export function renderCurrentViewExports(model: ReturnType<typeof currentViewExportModel>) {
  const headings = model.language === "es" ? ["Origen", "Estado", "Empresa"] : ["Source", "Status", "Company"];
  return {
    pdf: { headings, rows: model.rows, totals: model.totals, fingerprint: model.fingerprint },
    excel: { headings, rows: model.rows, totals: model.totals, fingerprint: model.fingerprint },
  };
}
