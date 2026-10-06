import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./page-assistant-context.ts", import.meta.url), "utf8");
assert.match(source, /input:not\(\[type=password\]\)/);
assert.match(source, /selectedOptions\[0\]/);
assert.match(source, /element\.value/);
assert.match(source, /visibleValues/);
assert.match(source, /projectId: project \? Number/);
assert.match(source, /language,/);
assert.match(source, /focusedControl/);
assert.match(source, /slice\(0, 60\)/);
assert.match(source, /data-assistant-highlight/);
console.log("PA126 page-aware minimum-context and exact-highlight contract: PASS");
