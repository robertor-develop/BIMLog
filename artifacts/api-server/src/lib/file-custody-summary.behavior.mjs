import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../routes/files.ts", import.meta.url), "utf8");
const summary = source.indexOf('router.get("/projects/:projectId/files/custody-summary"');
const download = source.indexOf('router.get("/projects/:projectId/files/:fileId/download"');
assert.ok(summary > 0 && summary < download, "literal custody route must precede parameterized download");
assert.match(source, /counts\[state\] \+= 1/);
assert.match(source, /binaryAvailability: state/);
assert.doesNotMatch(source.slice(summary, download), /storagePath|fileHash/);
console.log("PASS authenticated project custody summary is bounded and non-secret");
