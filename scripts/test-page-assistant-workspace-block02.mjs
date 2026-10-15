import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const panel=readFileSync("artifacts/bimlog/src/components/layout/PageAssistant.tsx","utf8");
const css=readFileSync("artifacts/bimlog/src/index.css","utf8");
for(const contract of [
  "assistantWidthFromPointer", "fitAssistantWidthToViewport", "resetPanelWidth", "toggleDock", "toggleCollapsed",
  'className="page-assistant-coming-soon"', 'title={tt("Coming soon","Próximamente")}',
  'data-dock={dock}', 'data-collapsed={collapsed}', 'role="separator"', 'aria-live="polite"'
]) assert.ok(panel.includes(contract),`missing Block 2 workspace contract: ${contract}`);
assert.doesNotMatch(panel,/onClick=\{\(\)=>\{setActiveTool\("feedback"\);submitFeedback\(false\);\}\}/);
assert.doesNotMatch(panel,/onClick=\{\(\)=>submitFeedback\(false\)\}/);
assert.match(css,/body\.bimlog-assistant-docked #root\{width:auto!important/);
assert.match(css,/body\.bimlog-assistant-docked\[data-assistant-dock-side="left"\] #root/);
assert.match(css,/body\.bimlog-assistant-docked\[data-assistant-dock-side="right"\] #root/);
assert.match(css,/@media\(max-width:900px\).*body\.bimlog-assistant-docked/s);
assert.match(css,/@media\(max-width:480px\)/);
console.log("page assistant workspace Block 2 acceptance: pass");
