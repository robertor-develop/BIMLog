import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../index.css", import.meta.url), "utf8");
for (const token of ["--bimlog-control-height", "--bimlog-card-radius", "--bimlog-page-gap", "--bimlog-focus-ring"]) assert.ok(css.includes(token), `missing ${token}`);
assert.ok(css.includes(".bimlog-workspace-content :where(input,select,textarea)"));
assert.ok(css.includes(".bimlog-workspace-content :where(.card,.panel)"));
console.log("VISUAL_SYSTEM_RESULT=PASS shared proportions and interaction tokens are present");
