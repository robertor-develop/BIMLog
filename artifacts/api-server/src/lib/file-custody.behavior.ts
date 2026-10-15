import assert from "node:assert/strict";
import { fileCustodyState, fileDownloadFailure } from "./file-custody.ts";

assert.equal(fileCustodyState({ storagePath: "aa/bb/" + "c".repeat(64), fileHash: "d".repeat(64), fileSizeBytes: 12, source: "user-uploaded" }), "portable");
assert.equal(fileCustodyState({ storagePath: null, fileHash: null, fileSizeBytes: null, source: "coordination_hub" }), "legacy_binary_missing");
assert.equal(fileCustodyState({ storagePath: null, fileHash: null, fileSizeBytes: null, source: "system-generated" }), "generated_on_demand");
assert.equal(fileCustodyState({ storagePath: "legacy/path", fileHash: null, fileSizeBytes: 12, source: "rfi-attachment" }), "custody_incomplete");
assert.deepEqual(fileDownloadFailure("legacy_binary_missing"), {
  status: 409,
  body: { code: "FILE_BINARY_NOT_RETAINED", error: "This legacy file record is preserved, but its original binary was not retained. Contact a project administrator to restore the verified original." },
});
console.log("PASS file custody states and truthful legacy failure");
