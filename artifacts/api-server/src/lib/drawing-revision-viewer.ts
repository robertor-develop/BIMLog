export type DrawingRevisionView = {
  tenantId: number;
  projectId: number;
  drawingId: string;
  fileId: number;
  revisionCode: string;
  mimeType: string;
  previewUrl?: string | null;
  downloadUrl: string;
};

const PREVIEWABLE = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

export function prepareDrawingRevisionComparison(input: { tenantId: number; projectId: number; left: DrawingRevisionView; right: DrawingRevisionView; authorized: boolean }) {
  if (!input.authorized) throw new Error("DRAWING_COMPARISON_NOT_AUTHORIZED");
  for (const revision of [input.left, input.right]) {
    if (revision.tenantId !== input.tenantId || revision.projectId !== input.projectId) throw new Error("DRAWING_COMPARISON_SCOPE_DENIED");
    if (!revision.downloadUrl) throw new Error("DRAWING_ORIGINAL_DOWNLOAD_REQUIRED");
  }
  const side = (revision: DrawingRevisionView) => Object.freeze({
    ...revision,
    previewState: !PREVIEWABLE.has(revision.mimeType) ? "unsupported" as const : revision.previewUrl ? "available" as const : "missing" as const,
    originalDownloadPreserved: true as const,
  });
  return Object.freeze({ mode: "side-by-side" as const, left: side(input.left), right: side(input.right), mutationAllowed: false as const });
}
