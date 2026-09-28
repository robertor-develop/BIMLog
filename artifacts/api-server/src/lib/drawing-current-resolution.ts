export type RegisterRevision = {
  tenantId: number; projectId: number; drawingId: string; sheetKey: string; revisionCode: string;
  issueDate: string; recordedAt: string; status: "active" | "superseded" | "withdrawn";
  sourceKind: "base_set" | "bulletin"; bulletinId?: string; bulletinInScope?: boolean;
};

export function resolveDrawingAsOf(input: { tenantId: number; projectId: number; asOf: string; revisions: readonly RegisterRevision[] }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.asOf)) throw new Error("DRAWING_AS_OF_INVALID");
  const scoped = input.revisions.filter(item => item.tenantId === input.tenantId && item.projectId === input.projectId && item.issueDate <= input.asOf && item.status !== "withdrawn");
  const groups = new Map<string, RegisterRevision[]>();
  for (const item of scoped) groups.set(item.sheetKey, [...(groups.get(item.sheetKey) ?? []), item]);
  const current = [...groups.entries()].map(([sheetKey, revisions]) => {
    const eligible = revisions.filter(item => item.sourceKind !== "bulletin" || item.bulletinInScope === true);
    const ordered = eligible.sort((a, b) => b.issueDate.localeCompare(a.issueDate) || b.recordedAt.localeCompare(a.recordedAt) || b.drawingId.localeCompare(a.drawingId));
    const selected = ordered[0] ?? null;
    return Object.freeze({ sheetKey, selected, fallbackApplied: Boolean(selected && revisions.some(item => item.sourceKind === "bulletin" && item.bulletinInScope === false && item.issueDate >= selected.issueDate)) });
  }).sort((a, b) => a.sheetKey.localeCompare(b.sheetKey));
  return Object.freeze({ tenantId: input.tenantId, projectId: input.projectId, asOf: input.asOf, current: Object.freeze(current),
    operation: "register_scope_resolution" as const, pdfFilteringEquivalent: false });
}
