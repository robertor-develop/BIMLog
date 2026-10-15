import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../routes/files.ts", import.meta.url), "utf8");
assert.match(source, /binaryAvailability:\s*fileCustodyState\(file\)/);
assert.match(source, /storagePath:\s*_storagePath/);
assert.match(source, /fileMetadata:\s*_fileMetadata/);
assert.doesNotMatch(source, /return \{ \.\.\.publicFile, storagePath/);
console.log("PASS public file contract exposes custody state without storage internals");
