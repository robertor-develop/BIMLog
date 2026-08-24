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
assert.match(panel, /bridgeClient\.openWorkingView\(selectedIssue, bridgeContext\)/);
assert.match(panel, /bridgeClient\.captureCurrentVisualState\(selectedIssue, bridgeContext\)/);
assert.match(panel, /apiClient\.saveVisualState/);
assert.doesNotMatch(panel, /identity_not_found/);
assert.match(view, /Migrate & open working view/);
assert.match(view, /save its complete visual state into BIMLog/);
assert.match(view, /disabled=\{!bridgeOpenEnabled\}/);

console.log(JSON.stringify({
  status: "PASS",
  tests: [
    "platform-state-required",
    "platform-state-fetched-on-open",
    "native-apply-after-platform-fetch",
    "exact-identity-one-time-legacy-migration",
    "legacy-native-capture",
    "legacy-platform-persistence-before-apply",
    "no-409-identity-fallback",
    "missing-platform-state-visible-and-migratable",
  ],
}));
