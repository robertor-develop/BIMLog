import assert from "node:assert/strict";
import fs from "node:fs";

const panel = fs.readFileSync(new URL("./LensNextPanel.tsx", import.meta.url), "utf8");
const createStart = panel.indexOf("const createIssue");
const createEnd = panel.indexOf("const materializeMyView", createStart);
assert.ok(createStart >= 0 && createEnd > createStart);
const handler = panel.slice(createStart, createEnd);
const capture = handler.indexOf("captureNewIssueNavigationView");
const platform = handler.indexOf("apiClient.createIssue");
assert.ok(capture >= 0 && platform > capture, "capture must precede the BIMLog platform commit");
assert.doesNotMatch(handler, /captureNewIssueVisualState|capture-visual-state/);
assert.doesNotMatch(handler, /createLocalSavedViewpoint|publishCreatedViewpoint|confirmCreatedLocalViewpoint/);
assert.match(handler, /No local Saved Viewpoint was created/);
assert.doesNotMatch(handler, /lens-sync|ActiveDocument\.Save|SaveFile|SaveAs/i);
const view = fs.readFileSync(new URL("./LensNextPanelView.tsx", import.meta.url), "utf8");
for (const label of ["Trade", "Floor", "Responsible company", "Report type", "Priority", "Status", "Instruction", "Open items / equipment tag", "Reason for audit history"])
  assert.match(view, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(view, /Create BIMLog Issue/);
assert.match(view, /Review Issue Creation/);
assert.match(view, /Confirm and Create BIMLog Issue/);
assert.doesNotMatch(view, /Create BIMLog viewpoint|Review viewpoint creation|Confirm and create BIMLog viewpoint/i);
console.log(JSON.stringify({ status: "PASS", tests: ["full-create-form", "explicit-review", "platform-only-creation", "no-saved-viewpoint-side-effect", "no-automatic-model-save"] }));
