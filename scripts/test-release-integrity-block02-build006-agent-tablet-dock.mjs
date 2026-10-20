import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync("artifacts/bimlog/src/index.css", "utf8");
const tablet = css.match(/@media\(min-width:761px\) and \(max-width:1179px\)\{([^}]|\}(?!\s*@media))*\}/s)?.[0] ?? "";

assert.ok(tablet, "tablet dock contract must exist");
assert.match(tablet, /--bimlog-agent-active-width:min\(var\(--bimlog-agent-dock-width\),calc\(100vw - 320px\)\)/);
assert.match(tablet, /max-width:calc\(100vw - 320px\)/);
assert.match(css, /body\.bimlog-assistant-docked \.bimlog-workspace-split\{grid-template-columns:minmax\(0,1fr\) var\(--bimlog-agent-active-width\)\}/);
assert.match(css, /body\.bimlog-assistant-docked\[data-assistant-dock-side="left"\] \.bimlog-workspace-split\{grid-template-columns:var\(--bimlog-agent-active-width\) minmax\(0,1fr\)\}/);
assert.doesNotMatch(tablet, /#root\{margin|margin-(?:left|right)/);
console.log("PASS build 006: tablet Agent dock reserves workspace");
