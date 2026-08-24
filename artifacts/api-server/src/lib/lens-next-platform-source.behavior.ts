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
assert.doesNotMatch(panel, /bridgeClient\.openWorkingView/);
assert.doesNotMatch(panel, /bridgeClient\.captureCurrentVisualState/);
assert.doesNotMatch(panel, /apiClient\.saveVisualState/);
assert.doesNotMatch(panel, /identity_not_found/);
assert.match(view, /BIMLog has no authoritative visual-state package/);
assert.match(view, /disabled=\{!bridgeOpenEnabled\}/);

console.log(JSON.stringify({
  status: "PASS",
  tests: [
    "platform-state-required",
    "platform-state-fetched-on-open",
    "native-apply-only",
    "no-local-saved-viewpoint-fallback",
    "no-click-time-native-capture",
    "no-click-time-platform-backfill",
    "no-409-identity-fallback",
    "missing-platform-state-visible-and-disabled",
  ],
}));
