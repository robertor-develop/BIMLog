import assert from "node:assert/strict";
import fs from "node:fs";

const panel = fs.readFileSync(new URL("./LensNextPanel.tsx", import.meta.url), "utf8");
const handler = panel.slice(panel.indexOf("const createViewpoint"), panel.indexOf("return (", panel.indexOf("const createViewpoint")));
const capture = handler.indexOf("captureNewViewpoint");
const platform = handler.indexOf("apiClient.createViewpoint");
const local = handler.indexOf("publishCreatedViewpoint");
assert.ok(capture >= 0 && platform > capture && local > platform, "capture must precede platform commit, which must precede local Saved Viewpoint creation");
assert.match(handler, /BIMLog created .*visual package, but Navisworks did not create/);
assert.doesNotMatch(handler, /lens-sync|ActiveDocument\.Save|SaveFile|SaveAs/i);
assert.match(handler, /Save the NWF\/NWD when ready/);
const view = fs.readFileSync(new URL("./LensNextPanelView.tsx", import.meta.url), "utf8");
for (const label of ["Trade", "Floor", "Responsible company", "Report type", "Priority", "Status", "Instruction", "Open items / equipment tag", "Reason for audit history"])
  assert.match(view, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(view, /Review viewpoint creation/);
assert.match(view, /Confirm and create viewpoint/);
console.log(JSON.stringify({ status: "PASS", tests: ["full-create-form", "explicit-review", "platform-first-order", "local-publish-after-receipt", "no-automatic-model-save"] }));
