export type DrawingLinkKind = "rfi" | "submittal" | "work_item" | "change_order" | "coordination_issue" | "lens_viewpoint";
export type DrawingRecordLink = { tenantId: number; projectId: number; drawingId: string; revisionCode: string; kind: DrawingLinkKind; targetId: string; targetProjectId: number; authorized: boolean };

export function buildDrawingRecordLinks(input: { tenantId: number; projectId: number; drawingId: string; revisionCode: string; links: readonly DrawingRecordLink[] }) {
  const seen = new Set<string>();
  const links = input.links.map(link => {
    if (!link.authorized) throw new Error("DRAWING_LINK_NOT_AUTHORIZED");
    if (link.tenantId !== input.tenantId || link.projectId !== input.projectId || link.targetProjectId !== input.projectId) throw new Error("DRAWING_LINK_SCOPE_DENIED");
    if (link.drawingId !== input.drawingId || link.revisionCode !== input.revisionCode) throw new Error("DRAWING_LINK_REVISION_MISMATCH");
    const identity = `${link.kind}:${link.targetId}`;
    if (seen.has(identity)) throw new Error("DRAWING_LINK_DUPLICATE");
    seen.add(identity);
    return Object.freeze({ ...link, copiedRecord: false as const });
  }).sort((a, b) => `${a.kind}:${a.targetId}`.localeCompare(`${b.kind}:${b.targetId}`));
  return Object.freeze({ drawingId: input.drawingId, revisionCode: input.revisionCode, links: Object.freeze(links), workingViewBehaviorChanged: false as const });
}
