import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const component=readFileSync("artifacts/bimlog/src/components/layout/PageAssistant.tsx","utf8");
const css=readFileSync("artifacts/bimlog/src/index.css","utf8");
for(const marker of ["data-dock={dock}","data-collapsed={collapsed}","page-assistant-resize-handle","page-assistant-workspace-status","aria-live=\"polite\"","aria-valuenow={panelWidth}","aria-valuetext=",'event.key==="Home"',"onDoubleClick", "Dock agent left","Dock agent right"]){
  assert.ok(component.includes(marker),`missing workspace control: ${marker}`);
}
assert.match(css,/@media\(max-width:480px\)/);
assert.match(css,/font-size:16px/);
assert.match(css,/safe-area-inset-bottom/);
assert.match(css,/page-assistant-actions\{grid-template-columns:repeat\(3,minmax\(116px,1fr\)\);overflow-x:auto/);
console.log("page assistant responsive workspace: pass");
