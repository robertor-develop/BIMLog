export const reportDatasets = ["coordination", "rfi", "submittal"] as const;
export type ReportDataset = typeof reportDatasets[number];

const capabilities = {
  coordination: { columns: ["number", "title", "status", "responsibleCompany", "updatedAt"], sorts: ["updated_desc", "updated_asc", "number_asc"], groups: ["status", "responsibleCompany"] },
  rfi: { columns: ["number", "subject", "status", "responsibleCompany", "dueAt", "updatedAt"], sorts: ["updated_desc", "due_asc", "number_asc"], groups: ["status", "responsibleCompany"] },
  submittal: { columns: ["number", "title", "status", "reviewerCompany", "dueAt", "updatedAt"], sorts: ["updated_desc", "due_asc", "number_asc"], groups: ["status", "reviewerCompany"] },
} as const;

export type ReportViewConfiguration = {
  schemaVersion: 2;
  dataset: ReportDataset;
  columns: string[];
  sort: string;
  groupBy: string | null;
  filters: Record<string, string | string[]>;
};

export function normalizeReportViewConfiguration(value: unknown): ReportViewConfiguration {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("REPORT_VIEW_INVALID");
  const raw = value as Record<string, unknown>;
  if (raw.schemaVersion !== 2 || !reportDatasets.includes(raw.dataset as ReportDataset)) throw new Error("REPORT_VIEW_SCHEMA_UNSUPPORTED");
  const dataset = raw.dataset as ReportDataset;
  const allowed = capabilities[dataset];
  const columns = Array.isArray(raw.columns) ? [...new Set(raw.columns.map(String))] : [];
  if (!columns.length || columns.some(column => !(allowed.columns as readonly string[]).includes(column))) throw new Error("REPORT_VIEW_COLUMN_UNSUPPORTED");
  const sort = String(raw.sort ?? "");
  if (!(allowed.sorts as readonly string[]).includes(sort)) throw new Error("REPORT_VIEW_SORT_UNSUPPORTED");
  const groupBy = raw.groupBy == null ? null : String(raw.groupBy);
  if (groupBy && !(allowed.groups as readonly string[]).includes(groupBy)) throw new Error("REPORT_VIEW_GROUP_UNSUPPORTED");
  const filters = raw.filters && typeof raw.filters === "object" && !Array.isArray(raw.filters) ? raw.filters as Record<string, unknown> : {};
  return { schemaVersion: 2, dataset, columns, sort, groupBy, filters: Object.fromEntries(Object.entries(filters).map(([key, entries]) => [key, Array.isArray(entries) ? [...new Set(entries.map(String))].sort() : String(entries)])) };
}

export function upgradeLegacyCoordinatorView(value: Record<string, unknown>): ReportViewConfiguration {
  return normalizeReportViewConfiguration({ schemaVersion: 2, dataset: "coordination", columns: ["number", "title", "status", "responsibleCompany", "updatedAt"], sort: "updated_desc", groupBy: null, filters: value });
}
