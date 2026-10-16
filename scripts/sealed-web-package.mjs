import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

function filesBelow(root, directory = root) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(root, full) : [{ path: path.relative(root, full).replaceAll("\\", "/"), sha256: sha256(fs.readFileSync(full)), bytes: fs.statSync(full).size }];
  });
}

export function createPackageSeal(entries) {
  const files = [...entries].sort((a, b) => a.path.localeCompare(b.path));
  if (!files.length) throw new Error("package has no files");
  if (new Set(files.map((entry) => entry.path)).size !== files.length) throw new Error("duplicate package path");
  const manifestSha256 = sha256(JSON.stringify(files));
  return { schemaVersion: "bimlog-web-package-seal-v1", manifestSha256, fileCount: files.length, totalBytes: files.reduce((sum, entry) => sum + entry.bytes, 0), files };
}

export function sealDirectory(directory) {
  return createPackageSeal(filesBelow(path.resolve(directory)));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = process.argv[2];
  if (!directory) throw new Error("usage: node scripts/sealed-web-package.mjs <assembled-directory>");
  console.log(JSON.stringify(sealDirectory(directory), null, 2));
}
