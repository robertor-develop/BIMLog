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
const workingView = fs.readFileSync(
  path.join(repositoryRoot, "artifacts/bimlog/src/features/lens-next/lens-next-working-view.ts"),
  "utf8",
);

assert.match(panel, /selectedIssue\.visualStateAvailable/);
assert.match(panel, /selectedIssue\.visualStateAvailable\s*&&\s*Boolean\(selectedIssue\.visualStateDigest\)/);
assert.match(workingView, /apiClient\.loadVisualState\(issue, signal\)/);
assert.match(workingView, /bridgeClient\.applyPlatformWorkingView\(issue, context, stored\.visualStateJson, signal\)/);
const openFunction = workingView.slice(
  workingView.indexOf("export async function openBimlogWorkingView"),
  workingView.indexOf("export async function repairBimlogWorkingViewFromCurrent"),
);
assert.doesNotMatch(openFunction, /openWorkingView/);
assert.doesNotMatch(openFunction, /captureCurrentVisualState/);
assert.doesNotMatch(openFunction, /saveVisualState/);
assert.doesNotMatch(openFunction, /identity_not_found|legacy_viewpoint_name/);
assert.match(openFunction, /BIMLog is the source of truth/);
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
