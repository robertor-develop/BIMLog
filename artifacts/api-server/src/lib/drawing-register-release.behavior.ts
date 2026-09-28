import assert from "node:assert/strict";
import { buildDrawingRegisterRelease } from "./drawing-register-release";

const drawing = { tenantId: 31, projectId: 26, drawingId: "DR-2", fileId: 901, fileSha256: "b".repeat(64), sheetKey: "31:26:IFC:A-101", revisionCode: "1", issueDate: "2026-09-20", current: true };
const input = { tenantId: 31, projectId: 26, sourceCommit: "c".repeat(40), releasedAt: "2026-09-28T16:00:00Z", drawings: [drawing], links: [
  { tenantId: 31, projectId: 26, drawingId: "DR-2", kind: "file" as const, targetId: "901", authorized: true },
  { tenantId: 31, projectId: 26, drawingId: "DR-2", kind: "rfi_attachment" as const, targetId: "RFI-10:A-1", authorized: true },
  { tenantId: 31, projectId: 26, drawingId: "DR-2", kind: "lens_reference" as const, targetId: "VP-7", authorized: true },
] };
const release = buildDrawingRegisterRelease(input);
assert.equal(release.drawings[0].current, true);
assert.deepEqual(release.compatibility, { existingFilesUnchanged: true, rfiAttachmentsUnchanged: true, lensContractsUnchanged: true });
assert.equal(buildDrawingRegisterRelease(input).fingerprint, release.fingerprint);
assert.throws(() => buildDrawingRegisterRelease({ ...input, links: [{ ...input.links[0], projectId: 99 }] }), /DRAWING_LINEAGE_SCOPE_DENIED/);
assert.throws(() => buildDrawingRegisterRelease({ ...input, links: [{ ...input.links[0], authorized: false }] }), /DRAWING_LINEAGE_NOT_AUTHORIZED/);
console.log("C060 drawing register release preserves authorized lineage and existing File/RFI/Lens contracts: PASS");
