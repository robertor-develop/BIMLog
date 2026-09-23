import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const view = readFileSync(new URL("./LensNextPanelView.tsx", import.meta.url), "utf8");
const panel = readFileSync(new URL("./LensNextPanel.tsx", import.meta.url), "utf8");
const native = readFileSync(new URL("../../../../../plugins/BIMLogLensNext/native/LensNextDockPanelControl.cs", import.meta.url), "utf8");

// These are the working paths that a responsive-only change must continue to use.
for (const marker of [
  "onOpenWorkingView",
  "onCreateIssue(createDraft, createReason.trim())",
  "onPublishAction",
  "onFiltersChange",
  "onSelectIssue",
  "Reference attachments",
  "Linked BIMLog items",
]) {
  assert.ok(view.toLowerCase().includes(marker.toLowerCase()), `Missing established Lens behavior: ${marker}`);
}
assert.match(panel, /selectedServerId/);
assert.match(panel, /issuePage/);
assert.match(panel, /authorizedProjectId/);
assert.match(native, /Create Issue/);
assert.match(native, /private void Settings\(/);
console.log("Lens Next responsive-dock frozen behavior baseline: PASS");
