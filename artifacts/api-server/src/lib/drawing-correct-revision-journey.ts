export type DrawingJourneyRevision = { drawingId: string; sheetKey: string; revisionCode: string; issueDate: string; current: boolean; viewerUrl: string };

export function resolveCorrectDrawingJourney(input: { requestedDrawingId: string; revisions: readonly DrawingJourneyRevision[] }) {
  const requested = input.revisions.find(item => item.drawingId === input.requestedDrawingId);
  if (!requested) return Object.freeze({ state: "missing" as const, warning: "Drawing reference is unavailable.", history: Object.freeze([]) });
  const history = input.revisions.filter(item => item.sheetKey === requested.sheetKey).sort((a, b) => b.issueDate.localeCompare(a.issueDate) || b.revisionCode.localeCompare(a.revisionCode));
  const current = history.find(item => item.current);
  if (!current) return Object.freeze({ state: "no-current-revision" as const, requested: Object.freeze({ ...requested }), warning: "No authorized current revision is available.", history: Object.freeze(history.map(item => Object.freeze({ ...item }))) });
  if (requested.drawingId === current.drawingId) return Object.freeze({ state: "current" as const, target: Object.freeze({ ...current }), warning: null, history: Object.freeze(history.map(item => Object.freeze({ ...item }))) });
  return Object.freeze({ state: "stale" as const, requested: Object.freeze({ ...requested }), target: Object.freeze({ ...current }), warning: `Revision ${requested.revisionCode} is historical. Open current revision ${current.revisionCode}.`, history: Object.freeze(history.map(item => Object.freeze({ ...item }))), silentlyReplaced: false as const });
}
