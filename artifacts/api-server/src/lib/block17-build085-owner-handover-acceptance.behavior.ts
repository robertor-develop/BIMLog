import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import AdmZip from "adm-zip";
import { buildProjectHandoverPackage } from "./project-handover-package";

const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const model = Buffer.from("ISO-10303-21; controlled IFC");
const drawing = Buffer.from("%PDF-1.7 controlled drawing %%EOF");
const files = [
  { id: 31, fileName: "Owner Model.ifc", mediaType: "application/octet-stream", byteSize: model.length, sha256: digest(model), status: "approved", relationship: "created", version: 3, createdAt: "2026-09-20T13:00:00.000Z", bytes: model },
  { id: 32, fileName: "Reviewed Drawing.pdf", mediaType: "application/pdf", byteSize: drawing.length, sha256: digest(drawing), status: "valid", relationship: "supporting", version: 1, createdAt: "2026-09-20T13:05:00.000Z", bytes: drawing },
];
const built = buildProjectHandoverPackage({ project: { id: 4, code: "OWNER-04", name: "Controlled Owner Project" }, generatedAt: "2026-09-20T14:00:00.000Z", files });
const zip = new AdmZip(built.archive), manifest = JSON.parse(zip.readAsText("manifest.json"));
assert.equal(manifest.files.length, 2);
assert.equal(manifest.files.every((file: any) => digest(zip.readFile(file.archivePath)!) === file.sha256), true);
assert.equal(digest(zip.readFile("manifest.json")!), built.manifestSha256);
assert.equal(digest(built.archive), built.archiveSha256);
assert.match(zip.readAsText("files.csv"), /Owner Model\.ifc/);
assert.match(zip.readAsText("files.xml"), /Reviewed Drawing\.pdf/);
assert.throws(() => buildProjectHandoverPackage({ project: { id: 4, code: "OWNER-04", name: "Controlled Owner Project" }, generatedAt: "2026-09-20T14:00:00.000Z", files: [{ ...files[0], sha256: "0".repeat(64) }] }), /HANDOVER_FILE_INTEGRITY_MISMATCH/);

const route = fs.readFileSync(new URL("../routes/files.ts", import.meta.url), "utf8");
for (const token of ['router.get("/projects/:projectId/files/handover.zip"', "requireProjectMember()", "HANDOVER_FILE_NOT_PORTABLE", "HANDOVER_PACKAGE_TOO_LARGE", "storage.downloadBounded", "X-BIMLog-Handover-SHA256", "X-BIMLog-Manifest-SHA256", 'actionType: "export"']) assert.ok(route.includes(token), `owner handover route missing ${token}`);
console.log("PASS Build 085 complete controlled owner handover, independent hashes, authorization boundary, audit event, and tamper refusal");
