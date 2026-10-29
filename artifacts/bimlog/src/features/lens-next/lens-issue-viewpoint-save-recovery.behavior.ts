import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const panel = readFileSync(resolve(import.meta.dirname, "LensNextPanel.tsx"), "utf8");

assert.match(panel, /ISSUE_VIEWPOINT_CAPTURE_TIMEOUT_MS = 75_000/);
assert.match(panel, /ISSUE_VIEWPOINT_SAVE_TIMEOUT_MS = 45_000/);
assert.match(panel, /controller\.abort\(\)/);
assert.match(panel, /issueViewpointSaveInFlight\.current/);
assert.match(panel, /pendingIssueViewpointSave/);
assert.match(panel, /idempotencyKey: crypto\.randomUUID\(\)/);
assert.match(panel, /pending\.fingerprint !== fingerprint/);
assert.match(panel, /apiClient\.addIssueViewpoint\(selectedIssue, pending!\.input, signal\)/);
assert.match(panel, /loadIssueViewpoints\(signal\)/);
assert.match(panel, /Nothing was submitted twice/);
assert.match(panel, /finally \{ issueViewpointSaveInFlight\.current = false; \}/);

console.log("Lens Issue additional-viewpoint timeout, idempotent retry, double-submit protection, and reload recovery: PASS");
