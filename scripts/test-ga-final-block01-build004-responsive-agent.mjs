import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const panel = readFileSync("artifacts/bimlog/src/components/layout/PageAssistant.tsx", "utf8");
const css = readFileSync("artifacts/bimlog/src/index.css", "utf8");

assert.match(css, /\.bimlog-workspace-split\{display:grid;grid-template-columns:minmax\(0,1fr\);min-height:100dvh\}/);
assert.match(css, /body\.bimlog-assistant-docked \.bimlog-workspace-split\{grid-template-columns:minmax\(0,1fr\) var\(--bimlog-agent-active-width\)/);
assert.match(css, /body\.bimlog-assistant-docked\[data-assistant-dock-side="left"\] \.bimlog-workspace-split\{grid-template-columns:var\(--bimlog-agent-active-width\) minmax\(0,1fr\)\}/);
assert.match(css, /\.page-assistant-panel\{position:sticky;top:0;width:100%;min-width:0;max-width:100%;height:100dvh/);
assert.match(css, /body\{--bimlog-agent-active-width:var\(--bimlog-agent-dock-width\)\}/);
assert.match(css, /body\[data-assistant-collapsed="true"\]\{--bimlog-agent-active-width:72px\}/);
assert.match(css, /@media\(min-width:761px\) and \(max-width:1024px\)\{[\s\S]*?\.app-shell>\.sidebar\{display:none\}[\s\S]*?\.app-shell>\.main-area\{width:100%;min-width:0;flex-basis:100%\}/);
assert.match(css, /@media\(max-width:760px\)\{html:has\(body\.bimlog-assistant-docked\),body\.bimlog-assistant-docked\{overflow:hidden\}/);
assert.match(css, /@media\(max-width:760px\)\{body\.bimlog-assistant-docked \.bimlog-workspace-split\{display:grid;grid-template-columns:minmax\(0,1fr\);grid-template-rows:minmax\(280px,42dvh\) minmax\(0,58dvh\);min-height:100dvh\}/);
assert.match(css, /body\.bimlog-assistant-docked \.bimlog-workspace-content\{display:block;grid-column:1;grid-row:1;min-height:280px;overflow:auto\}/);
assert.match(css, /\.page-assistant-panel\{position:sticky;top:0;width:100%;height:58dvh;min-height:0/);
assert.match(css, /\[data-page-assistant-open="true"\]\{grid-column:1;grid-row:2;min-width:0\}/);
assert.match(css, /@media\(max-width:760px\)[\s\S]*?\.page-assistant-panel\{[^}]*z-index:1400/);
assert.match(css, /@media\(max-width:760px\)[\s\S]*?\.page-assistant-resize-handle\{display:none\}/);
assert.match(css, /@media\(max-width:760px\)[\s\S]*?\.page-assistant-question textarea\{min-height:88px;font-size:16px\}/);
assert.match(css, /\.page-assistant-status-strip\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\);overflow-x:hidden/);
assert.match(panel, /aria-label=\{voiceListening\?tt\("Stop dictation","Detener dictado"\):tt\("Dictate your question","Dictar tu pregunta"\)\}/);
assert.match(panel, /aria-live="polite" aria-busy=\{busy\}/);
assert.match(panel, /aria-keyshortcuts="Alt\+Shift\+A"/);
assert.match(panel, /id="bimlog-agent-include-selected" name="includeSelectedFieldValue" type="checkbox"/);

console.log("GA-F01-B004 responsive and accessible agent acceptance: PASS");
