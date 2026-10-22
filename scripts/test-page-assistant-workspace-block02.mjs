import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const panel=readFileSync("artifacts/bimlog/src/components/layout/PageAssistant.tsx","utf8");
const css=readFileSync("artifacts/bimlog/src/index.css","utf8");
for(const contract of [
  "assistantWidthFromPointer", "fitAssistantWidthToViewport", "resetPanelWidth", "toggleDock", "toggleCollapsed",
  'onClick={()=>input.current?.focus()}',
  'data-dock={dock}', 'data-collapsed={collapsed}', 'role="separator"', 'aria-live="polite"'
]) assert.ok(panel.includes(contract),`missing Block 2 workspace contract: ${contract}`);
assert.doesNotMatch(panel,/onClick=\{\(\)=>\{setActiveTool\("feedback"\);submitFeedback\(false\);\}\}/);
assert.doesNotMatch(panel,/onClick=\{\(\)=>submitFeedback\(false\)\}/);
assert.doesNotMatch(panel,/Submit feedback|Enviar comentarios|Request a fix|Solicitar una corrección|page-assistant-coming-soon/);
assert.match(css,/@media\(max-width:760px\).*body\.bimlog-assistant-docked/s);
assert.match(css,/@media\(max-width:480px\)/);
assert.match(css,/bimlog-workspace-split/);
assert.match(css,/contain:layout/);
console.log("page assistant workspace Block 2 acceptance: pass");
