import assert from "node:assert/strict";
import { defineDrawingIdentity } from "./drawing-register-identity";

const base = { tenantId: 31, projectId: 26, fileId: 900, fileSha256: "a".repeat(64), setCode: "IFC", sheetNumber: "A-101", title: "Ground Floor Plan", discipline: "Architecture" };
const first = defineDrawingIdentity(base);
assert.equal(first.projectSheetKey, "31:26:IFC:A-101");
assert.equal(first.fileId, 900);
assert.equal(first.fileSha256, "a".repeat(64));
assert.notEqual(defineDrawingIdentity({ ...base, projectId: 27 }).projectSheetKey, first.projectSheetKey);
assert.equal(defineDrawingIdentity({ ...base, setCode: " ifc ", sheetNumber: " a-101 " }).fingerprint, first.fingerprint);
assert.throws(() => defineDrawingIdentity({ ...base, fileSha256: "mutable-path" }), /DRAWING_FILE_DIGEST_INVALID/);
console.log("C056 drawing identity links existing immutable file bytes with project-scoped sheet identity: PASS");
