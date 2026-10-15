import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../routes/files.ts", import.meta.url), "utf8");
assert.match(source, /fileDownloadFailure\(fileCustodyState\(file\)\)/);
assert.match(source, /res\.status\(failure\.status\)\.json\(failure\.body\)/);
assert.doesNotMatch(source, /Binary download not available/);
console.log("PASS file downloads return an actionable custody failure");
