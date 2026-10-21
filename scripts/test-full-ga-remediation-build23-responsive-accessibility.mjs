import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runNodeGate } from "./lib/observable-gate-runner.mjs";

runNodeGate("scripts/test-ga-final-block05-build032-mobile-accessibility.mjs");

const assistant = readFileSync("artifacts/bimlog/src/components/layout/PageAssistant.tsx", "utf8");
for (const contract of [
  "Resize BIMLog Agent panel",
  "aria-valuemin={320}",
  "aria-valuemax={680}",
  'window.addEventListener("pointermove",move)',
  'window.addEventListener("pointerup",stop,{once:true})',
]) assert.ok(assistant.includes(contract), `Agent responsive contract missing ${contract}`);

const css = readFileSync("artifacts/bimlog/src/index.css", "utf8");
assert.match(css, /@media\s*\(max-width:\s*760px\)/);
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /focus-visible/);

console.log("Full-GA Block 5 Build 23 desktop, tablet, exact-390 and accessible Agent layout contracts: PASS");
