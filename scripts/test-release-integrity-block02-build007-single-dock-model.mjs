import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync("artifacts/bimlog/src/index.css", "utf8");
const panel = readFileSync("artifacts/bimlog/src/components/layout/PageAssistant.tsx", "utf8");

assert.doesNotMatch(css, /data-dock\s*=\s*["']?float/i);
assert.doesNotMatch(css, /aria-label\s*\*=\s*["']?Float/i);
assert.doesNotMatch(panel, /data-dock=["']float|Float panel|startDrag/i);
assert.match(panel, /type AssistantDockSide/);
assert.match(panel, /data-dock=\{dock\}/);
console.log("PASS build 007: Agent has one left-right dock model");
