import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync(new URL("../routes/files.ts", import.meta.url), "utf8");

assert.match(route, /source:\s*"user-uploaded",\s*storagePath:\s*filePath,/s,
  "accepted customer uploads must bind their durable object key to the file row");
assert.match(route, /status:\s*"rejected"[\s\S]*?storagePath:\s*filePath,/,
  "rejected metadata records must retain custody of the uploaded bytes for governed review");
assert.match(route, /if \(file\.storagePath\)[\s\S]*?storage\.download\(file\.storagePath\)[\s\S]*?safeDownloadDisposition/,
  "stored arbitrary file types must use the governed download path and safe disposition");

console.log("PASS Build 081 arbitrary uploaded-file custody and governed download continuity");
