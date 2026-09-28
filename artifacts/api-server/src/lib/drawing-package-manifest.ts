import crypto from "node:crypto";

export type DrawingPackageEntry = { tenantId: number; projectId: number; drawingId: string; fileId: number; fileSha256: string; sheetKey: string; revisionCode: string; current: boolean; sourceMarkupState: "not_supplied" | "supplied_unverified" | "verified" };

export function buildDrawingPackageManifest(input: { tenantId: number; projectId: number; packageId: string; createdAt: string; entries: readonly DrawingPackageEntry[] }) {
  if (!input.packageId.trim() || Number.isNaN(Date.parse(input.createdAt))) throw new Error("DRAWING_PACKAGE_IDENTITY_INVALID");
  const sheetKeys = new Set<string>();
  const entries = input.entries.map(entry => {
    if (entry.tenantId !== input.tenantId || entry.projectId !== input.projectId) throw new Error("DRAWING_PACKAGE_SCOPE_DENIED");
    if (!entry.current) throw new Error("DRAWING_PACKAGE_STALE_REVISION");
    if (sheetKeys.has(entry.sheetKey)) throw new Error("DRAWING_PACKAGE_DUPLICATE_SHEET");
    sheetKeys.add(entry.sheetKey);
    return Object.freeze({ ...entry, markupClaimAllowed: entry.sourceMarkupState === "verified" });
  }).sort((a, b) => a.sheetKey.localeCompare(b.sheetKey));
  const body = { tenantId: input.tenantId, projectId: input.projectId, packageId: input.packageId, createdAt: input.createdAt, entries, limitations: { pdfFilteringIsNotSourceMarkup: true, absentMarkupRemainsAbsent: true } };
  return Object.freeze({ ...body, entries: Object.freeze(entries), sha256: crypto.createHash("sha256").update(JSON.stringify(body)).digest("hex") });
}
