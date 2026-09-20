import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import AdmZip from "adm-zip";
import { buildProjectHandoverPackage } from "./project-handover-package";

const bytes = Buffer.from("controlled model bytes");
const built = buildProjectHandoverPackage({ project: { id: 9, code: "PX-09", name: "Portable Project" }, generatedAt: "2026-09-20T12:00:00.000Z", files: [{ id: 11, fileName: "coordination & review.ifc", mediaType: "application/octet-stream", byteSize: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), status: "approved", relationship: "created", version: 2, createdAt: "2026-09-20T11:00:00.000Z", bytes }] });
const zip = new AdmZip(built.archive), entries = zip.getEntries().map(entry => entry.entryName).sort();
assert.deepEqual(entries, ["files.csv", "files.xml", "files/00000011-coordination & review.ifc", "manifest.json"]);
const manifest = JSON.parse(zip.readAsText("manifest.json"));
assert.equal(manifest.files.length, 1);
assert.equal(manifest.artifacts["files.csv"], createHash("sha256").update(zip.readFile("files.csv")!).digest("hex"));
assert.equal(manifest.artifacts["files.xml"], createHash("sha256").update(zip.readFile("files.xml")!).digest("hex"));
assert.match(zip.readAsText("files.xml"), /coordination &amp; review\.ifc/);
assert.match(zip.readAsText("files.csv"), /coordination & review\.ifc/);
assert.equal(createHash("sha256").update(zip.readFile(manifest.files[0].archivePath)!).digest("hex"), manifest.files[0].sha256);
console.log("PASS Build 084 CSV/XML/ZIP portability, manifest hashes, filter-ready record input, and independent re-import readability");
