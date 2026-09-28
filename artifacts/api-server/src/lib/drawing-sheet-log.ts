import type { DrawingRegisterItem } from "./drawing-register-release";

export type DrawingSheetLogFilter = {
  discipline?: string;
  setCode?: string;
  revisionCode?: string;
  asOf?: string;
  currentOnly?: boolean;
};

export type DrawingSheetLogItem = DrawingRegisterItem & {
  discipline: string;
  setCode: string;
};

export function filterDrawingSheetLog(items: readonly DrawingSheetLogItem[], filter: DrawingSheetLogFilter) {
  const asOf = filter.asOf ? Date.parse(filter.asOf) : null;
  if (filter.asOf && Number.isNaN(asOf)) throw new Error("DRAWING_LOG_AS_OF_INVALID");
  const scoped = items.filter(item =>
    (!filter.discipline || item.discipline === filter.discipline) &&
    (!filter.setCode || item.setCode === filter.setCode) &&
    (!filter.revisionCode || item.revisionCode === filter.revisionCode) &&
    (asOf === null || Date.parse(item.issueDate) <= asOf),
  );
  const latestBySheet = new Map<string, DrawingSheetLogItem>();
  for (const item of scoped) {
    const current = latestBySheet.get(item.sheetKey);
    if (!current || item.issueDate > current.issueDate || (item.issueDate === current.issueDate && item.revisionCode > current.revisionCode)) latestBySheet.set(item.sheetKey, item);
  }
  return scoped
    .map(item => Object.freeze({ ...item, latestInFilteredScope: latestBySheet.get(item.sheetKey)?.drawingId === item.drawingId }))
    .filter(item => !filter.currentOnly || item.latestInFilteredScope)
    .sort((a, b) => a.sheetKey.localeCompare(b.sheetKey) || b.issueDate.localeCompare(a.issueDate));
}
