import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync("artifacts/bimlog/src/index.css", "utf8");
const tablet = css.match(/@media\(min-width:761px\) and \(max-width:1179px\)\{([^}]|\}(?!\s*@media))*\}/s)?.[0] ?? "";

assert.ok(tablet, "tablet dock contract must exist");
assert.match(tablet, /margin-right:var\(--bimlog-agent-dock-width\)!important/);
assert.match(tablet, /margin-left:var\(--bimlog-agent-dock-width\)!important/);
assert.match(tablet, /max-width:calc\(100vw - 320px\)/);
assert.doesNotMatch(tablet, /#root\{margin:0!important\}/);
console.log("PASS build 006: tablet Agent dock reserves workspace");
