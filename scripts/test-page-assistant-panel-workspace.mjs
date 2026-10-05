import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const component=readFileSync("artifacts/bimlog/src/components/layout/PageAssistant.tsx","utf8");
const css=readFileSync("artifacts/bimlog/src/index.css","utf8");
for(const token of ["Dock left","Dock right","Float panel","Minimize assistant","Restore assistant","startDrag","pointermove","bimlog-assistant-dock"])assert.ok(component.includes(token),token);
assert.match(css,/resize:both/);
assert.match(css,/data-minimized=true/);
assert.match(css,/@media\(max-width:640px\)/);
console.log("PASS assistant movable panel workspace");
