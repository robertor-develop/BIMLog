import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("artifacts/bimlog/src/lib/page-assistant-context.ts", "utf8");
assert.match(source, /pageText: string\[\]/);
assert.match(source, /main option/);
assert.match(source, /input:not\(\[type=password\]\)/);
assert.doesNotMatch(source, /\.value\b/);
assert.match(source, /slice\(0, 120\)/);
assert.match(source, /slice\(0, 60\)/);
console.log("PASS page assistant safe context envelope");
