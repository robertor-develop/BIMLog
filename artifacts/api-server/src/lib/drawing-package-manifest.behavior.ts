import assert from "node:assert/strict";
import { buildDrawingPackageManifest } from "./drawing-package-manifest";

const entry = { tenantId: 31, projectId: 26, drawingId: "DR-2", fileId: 11, fileSha256: "d".repeat(64), sheetKey: "31:26:IFC:A-101", revisionCode: "2", current: true, sourceMarkupState: "not_supplied" as const };
const input = { tenantId: 31, projectId: 26, packageId: "PKG-1", createdAt: "2026-09-28T17:00:00Z", entries: [entry] };
const manifest = buildDrawingPackageManifest(input);
assert.equal(manifest.entries[0].markupClaimAllowed, false);
assert.equal(manifest.limitations.pdfFilteringIsNotSourceMarkup, true);
assert.equal(buildDrawingPackageManifest(input).sha256, manifest.sha256);
assert.throws(() => buildDrawingPackageManifest({ ...input, entries: [{ ...entry, current: false }] }), /DRAWING_PACKAGE_STALE_REVISION/);
assert.throws(() => buildDrawingPackageManifest({ ...input, entries: [entry, { ...entry, drawingId: "DR-3" }] }), /DRAWING_PACKAGE_DUPLICATE_SHEET/);
const verified = buildDrawingPackageManifest({ ...input, entries: [{ ...entry, sourceMarkupState: "verified" }] });
assert.equal(verified.entries[0].markupClaimAllowed, true);
console.log("C064 drawing package manifest preserves current identity and explicit source/markup limitations: PASS");
