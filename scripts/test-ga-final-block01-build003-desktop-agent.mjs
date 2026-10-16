import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const panel = readFileSync("artifacts/bimlog/src/components/layout/PageAssistant.tsx", "utf8");
const css = readFileSync("artifacts/bimlog/src/index.css", "utf8");

assert.match(css, /\.page-assistant-panel\{[^}]*height:100dvh!important/);
assert.match(css, /\.page-assistant-panel\{[^}]*overflow-x:hidden;overflow-y:auto/);
assert.match(css, /@media\(min-width:1180px\)\{body\.bimlog-assistant-docked\[data-assistant-dock-side="right"\] #root\{margin-right:calc\(var\(--bimlog-agent-dock-width\) \+ 24px\)/);
assert.match(css, /\.page-assistant-resize-handle\{[^}]*cursor:ew-resize/);
assert.match(panel, /role="separator"[^>]*aria-orientation="vertical"/);
assert.match(panel, /onPointerDown=\{startResize\}/);
assert.match(panel, /onDoubleClick=\{resetPanelWidth\}/);
assert.match(panel, /if\(nextTurns\.some\(turn=>turn\.state==="complete"&&turn\.answer\)\)setError\(""\)/);
assert.match(panel, /className="page-assistant-coming-soon" aria-disabled="true" title=\{tt\("Coming soon","Próximamente"\)\}/);
assert.doesNotMatch(panel, /className="page-assistant-coming-soon"[^>]*onClick=\{\(\)=>void report/);

console.log("GA-F01-B003 desktop agent workspace acceptance: PASS");
