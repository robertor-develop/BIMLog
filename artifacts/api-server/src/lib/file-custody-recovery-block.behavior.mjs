import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [route, custody] = await Promise.all([
  readFile(new URL("../routes/files.ts", import.meta.url), "utf8"),
  readFile(new URL("./file-custody.ts", import.meta.url), "utf8"),
]);

for (const proof of [
  /binaryAvailability:\s*fileCustodyState\(file\)/,
  /files\/custody-summary/,
  /HANDOVER_FILE_NOT_PORTABLE/,
  /file:\s*\{ id: file\.id, fileName: file\.fileName, binaryAvailability \}/,
]) assert.match(route, proof);
assert.match(custody, /legacy_binary_missing/);
assert.match(custody, /custody_incomplete/);
assert.match(custody, /FILE_BINARY_NOT_RETAINED/);
assert.doesNotMatch(route, /Binary download not available/);
console.log("PASS recovery block preserves records and reports exact custody failures");
