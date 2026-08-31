import assert from "node:assert/strict";
import fs from "node:fs";

const panel = fs.readFileSync(new URL("./LensNextPanel.tsx", import.meta.url), "utf8");
const createStart = panel.indexOf("const createViewpoint");
const createEnd = panel.indexOf("const materializeMyView", createStart);
assert.ok(createStart >= 0 && createEnd > createStart);
const handler = panel.slice(createStart, createEnd);
const capture = handler.indexOf("captureNewViewpoint");
const platform = handler.indexOf("apiClient.createViewpoint");
assert.ok(capture >= 0 && platform > capture, "capture must precede the BIMLog platform commit");
assert.doesNotMatch(handler, /publishCreatedViewpoint|confirmCreatedLocalViewpoint/);
assert.match(handler, /no Navisworks Saved Viewpoint was created/);
assert.doesNotMatch(handler, /lens-sync|ActiveDocument\.Save|SaveFile|SaveAs/i);
const view = fs.readFileSync(new URL("./LensNextPanelView.tsx", import.meta.url), "utf8");
for (const label of ["Trade", "Floor", "Responsible company", "Report type", "Priority", "Status", "Instruction", "Open items / equipment tag", "Reason for audit history"])
  assert.match(view, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(view, /Review viewpoint creation/);
assert.match(view, /Confirm and create BIMLog issue/);
console.log(JSON.stringify({ status: "PASS", tests: ["full-create-form", "explicit-review", "platform-only-creation", "no-saved-viewpoint-side-effect", "no-automatic-model-save"] }));
