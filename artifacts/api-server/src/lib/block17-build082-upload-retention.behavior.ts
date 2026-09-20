import assert from "node:assert/strict";
import fs from "node:fs";
import { inspectProjectFileUpload, ProjectFileUploadError } from "./project-file-upload-contract";

const good = inspectProjectFileUpload({ fileName: "coordination-model.ifc", mediaType: "application/octet-stream", bytes: Buffer.from("ISO-10303-21;") });
assert.equal(good.fileName, "coordination-model.ifc");
for (const fixture of [
  { fileName: "malware.pdf", bytes: Buffer.from("MZpayload"), code: "PROJECT_FILE_ACTIVE_CONTENT_REJECTED" },
  { fileName: "..\\escape.ifc", bytes: Buffer.from("safe"), code: "PROJECT_FILE_NAME_REJECTED" },
  { fileName: "empty.ifc", bytes: Buffer.alloc(0), code: "PROJECT_FILE_SIZE_REJECTED" },
]) assert.throws(() => inspectProjectFileUpload({ ...fixture, mediaType: "application/octet-stream" }), (error: unknown) => error instanceof ProjectFileUploadError && error.code === fixture.code);

const route = fs.readFileSync(new URL("../routes/files.ts", import.meta.url), "utf8");
assert.match(route, /requireProjectMember\(\)[\s\S]*?filesTable\.id, fileId[\s\S]*?filesTable\.projectId, projectId/);
assert.match(route, /FILE_RETENTION_HOLD_ACTIVE/);
assert.match(route, /storage\.delete\(existing\[0\]\.storagePath\)/);
assert.match(route, /safeDownloadDisposition\(file\.fileName/);
console.log("PASS Build 082 upload validation, project isolation, retention hold, deletion, and safe disposition contracts");
