import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const component = readFileSync("artifacts/bimlog/src/components/layout/PageAssistant.tsx", "utf8");
const workspace = readFileSync("artifacts/bimlog/src/lib/page-assistant-workspace.ts", "utf8");
const css = readFileSync("artifacts/bimlog/src/index.css", "utf8");

for (const token of ["YOUR BIMLOG AGENT", "Ask a question", "Show me where", "Submit feedback", "Page guide and work status", "bimlog-assistant-docked"])
  assert.ok(component.includes(token) || css.includes(token), token);
assert.ok(component.includes('classList.toggle("bimlog-assistant-docked",open&&Boolean(token))'));
for (const token of ["Dock agent left", "Dock agent right", "Minimize agent", "Expand agent", "Resize BIMLog Agent panel"])
  assert.ok(component.includes(token), token);
for (const token of ["bimlog:assistant-width", "bimlog:assistant-dock", "bimlog:assistant-collapsed"])
  assert.ok(workspace.includes(token), token);
assert.match(component, /aria-controls="bimlog-page-assistant"/);
assert.match(component, /role="separator"/);
assert.match(css,/bimlog-workspace-split/);
assert.match(css, /data-assistant-dock-side="left"/);
assert.match(css, /grid-template-columns:minmax\(0,1fr\) var\(--bimlog-agent-active-width\)/);
assert.match(css, /data-collapsed="true"/);
assert.match(css, /@media\(max-width:760px\).*bimlog-workspace-content\{display:none/s);
assert.doesNotMatch(component + css, /data-dock\s*=\s*["']?float|Float panel|startDrag/i);
console.log("PASS assistant dock workspace source contract");

