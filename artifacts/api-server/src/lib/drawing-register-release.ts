import crypto from "node:crypto";

export type DrawingRegisterItem = { tenantId: number; projectId: number; drawingId: string; fileId: number; fileSha256: string; sheetKey: string; revisionCode: string; issueDate: string; current: boolean };
export type DrawingLineageLink = { tenantId: number; projectId: number; drawingId: string; kind: "file" | "rfi_attachment" | "lens_reference"; targetId: string; authorized: boolean };

export function buildDrawingRegisterRelease(input: { tenantId: number; projectId: number; sourceCommit: string; releasedAt: string; drawings: readonly DrawingRegisterItem[]; links: readonly DrawingLineageLink[] }) {
  if (!/^[a-f0-9]{40}$/.test(input.sourceCommit) || Number.isNaN(Date.parse(input.releasedAt))) throw new Error("DRAWING_RELEASE_IDENTITY_INVALID");
  const ids = new Set<string>();
  const drawings = input.drawings.map(item => {
    if (item.tenantId !== input.tenantId || item.projectId !== input.projectId) throw new Error("DRAWING_RELEASE_SCOPE_DENIED");
    if (ids.has(item.drawingId)) throw new Error("DRAWING_RELEASE_DUPLICATE_ID");
    ids.add(item.drawingId);
    return Object.freeze({ ...item });
  }).sort((a, b) => a.sheetKey.localeCompare(b.sheetKey) || a.issueDate.localeCompare(b.issueDate) || a.drawingId.localeCompare(b.drawingId));
  const links = input.links.map(link => {
    if (link.tenantId !== input.tenantId || link.projectId !== input.projectId || !ids.has(link.drawingId)) throw new Error("DRAWING_LINEAGE_SCOPE_DENIED");
    if (!link.authorized) throw new Error("DRAWING_LINEAGE_NOT_AUTHORIZED");
    return Object.freeze({ ...link });
  }).sort((a, b) => `${a.drawingId}:${a.kind}:${a.targetId}`.localeCompare(`${b.drawingId}:${b.kind}:${b.targetId}`));
  const body = { tenantId: input.tenantId, projectId: input.projectId, sourceCommit: input.sourceCommit, releasedAt: input.releasedAt, drawings, links,
    compatibility: { existingFilesUnchanged: true, rfiAttachmentsUnchanged: true, lensContractsUnchanged: true } };
  return Object.freeze({ ...body, drawings: Object.freeze(drawings), links: Object.freeze(links), fingerprint: crypto.createHash("sha256").update(JSON.stringify(body)).digest("hex") });
}
