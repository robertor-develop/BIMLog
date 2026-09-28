export type DrawingRevision = {
  tenantId: number; projectId: number; drawingId: string; fileId: number; fileSha256: string;
  setCode: string; sheetNumber: string; revisionCode: string; issueDate: string; status: "active" | "superseded" | "withdrawn";
};

const canonical = (value: string) => value.trim().toUpperCase();
const date = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) throw new Error("DRAWING_ISSUE_DATE_INVALID");
  return value;
};

export function matchDrawingRevision(candidate: DrawingRevision, existing: readonly DrawingRevision[]) {
  date(candidate.issueDate);
  const matches = existing.filter(item => item.tenantId === candidate.tenantId && item.projectId === candidate.projectId &&
    canonical(item.setCode) === canonical(candidate.setCode) && canonical(item.sheetNumber) === canonical(candidate.sheetNumber) && item.status === "active");
  if (matches.length > 1) return Object.freeze({ decision: "ambiguous" as const, automaticSupersessionAllowed: false, matches: Object.freeze(matches) });
  if (!matches.length) return Object.freeze({ decision: "new_sheet" as const, automaticSupersessionAllowed: false, matches: Object.freeze(matches) });
  const prior = matches[0];
  if (prior.fileSha256 === candidate.fileSha256) return Object.freeze({ decision: "same_bytes" as const, automaticSupersessionAllowed: false, matches: Object.freeze(matches) });
  if (candidate.issueDate < prior.issueDate) return Object.freeze({ decision: "older_candidate" as const, automaticSupersessionAllowed: false, matches: Object.freeze(matches) });
  return Object.freeze({ decision: "reviewable_successor" as const, automaticSupersessionAllowed: false, matches: Object.freeze(matches), supersedesDrawingId: prior.drawingId });
}
