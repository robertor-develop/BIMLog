import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const panel = readFileSync("artifacts/bimlog/src/components/layout/PageAssistant.tsx", "utf8");
const css = readFileSync("artifacts/bimlog/src/index.css", "utf8");

assert.match(css, /@media\(min-width:761px\) and \(max-width:1179px\)\{[\s\S]*?\.page-assistant-panel\{width:var\(--bimlog-agent-dock-width\)!important;max-width:calc\(100vw - 320px\)\}\}/);
assert.match(css, /@media\(max-width:760px\)\{html:has\(body\.bimlog-assistant-docked\),body\.bimlog-assistant-docked\{overflow:hidden\}/);
assert.match(css, /@media\(max-width:760px\)[\s\S]*?\.page-assistant-panel\{inset:0!important;width:100vw!important;max-width:100vw;min-width:0;height:100dvh!important/);
assert.match(css, /@media\(max-width:760px\)[\s\S]*?\.page-assistant-resize-handle\{display:none\}/);
assert.match(css, /@media\(max-width:760px\)[\s\S]*?\.page-assistant-question textarea\{min-height:88px;font-size:16px\}/);
assert.match(css, /\.page-assistant-status-strip\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\);overflow-x:hidden/);
assert.match(panel, /aria-label=\{voiceListening\?tt\("Stop dictation","Detener dictado"\):tt\("Dictate your question","Dictar tu pregunta"\)\}/);
assert.match(panel, /aria-live="polite" aria-busy=\{busy\}/);
assert.match(panel, /aria-keyshortcuts="Alt\+Shift\+A"/);

console.log("GA-F01-B004 responsive and accessible agent acceptance: PASS");
