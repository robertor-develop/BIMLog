import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const api = await readFile(new URL("../routes/transmittals.ts", import.meta.url), "utf8");
const ui = await readFile(new URL("../../../bimlog/src/pages/project/TransmittalsTab.tsx", import.meta.url), "utf8");
const checks = [
  [ui, /Number, title, purpose, recipient/],
  [ui, /value=\{filter\}[\s\S]*setFilter/],
  [ui, /PrintPdfButton/],
  [ui, /buildCurrentViewParams/],
  [ui, /parseExactTransmittalDeepLink/],
  [ui, /item\.id === exactTransmittalDeepLink\.id/],
  [api, /parseTransmittalRegisterFilters/],
  [api, /filterTransmittalsForRegisterPdf/],
  [api, /contentHash/],
  [api, /singleFileUpload\(\{ fileSize: 50 \* 1024 \* 1024 \}\)/],
];
for (const [source, pattern] of checks) assert.match(source, pattern);
assert.doesNotMatch(ui, /BUILD25E|BUILD26A|diagnostic probe/i);
console.log("PASS post-P17 Build 39 Transmittal workflow UI (11 checks)");
