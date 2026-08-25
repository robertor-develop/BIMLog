import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");
const panel = fs.readFileSync(
  path.join(repositoryRoot, "artifacts/bimlog/src/features/lens-next/LensNextPanel.tsx"),
  "utf8",
);
const view = fs.readFileSync(
  path.join(repositoryRoot, "artifacts/bimlog/src/features/lens-next/LensNextPanelView.tsx"),
  "utf8",
);

assert.match(panel, /selectedIssue\.visualStateAvailable/);
assert.match(panel, /apiClient\.loadVisualState\(selectedIssue\)/);
assert.match(panel, /bridgeClient\.applyPlatformWorkingView/);
assert.doesNotMatch(panel, /bridgeClient\.openWorkingView\(selectedIssue, bridgeContext\)/);
assert.doesNotMatch(panel, /bridgeClient\.captureCurrentVisualState\(selectedIssue, bridgeContext\)/);
assert.doesNotMatch(panel, /apiClient\.saveVisualState/);
assert.doesNotMatch(panel, /identity_not_found/);
assert.match(view, /Open working view/);
assert.match(view, /will not search or capture a local Saved Viewpoint/);
assert.match(view, /Upload is handled separately by the governed synchronization workflow/);
assert.match(view, /disabled=\{!bridgeOpenEnabled\}/);

console.log(JSON.stringify({
  status: "PASS",
  tests: [
    "platform-state-required",
    "platform-state-fetched-on-open",
    "native-apply-after-platform-fetch",
    "no-local-viewpoint-first-open-fallback",
    "no-native-visual-capture-on-platform-open",
    "no-platform-backfill-on-open",
    "no-409-identity-fallback",
    "missing-platform-state-visible-and-blocked",
  ],
}));
