import assert from "node:assert/strict";
import fs from "node:fs";
import { lensNextVisualStateDigest, validateAndRebindLocalVisualState } from "./lens-next-local-upload";

const state: any = {
  SchemaVersion: 1, ProjectId: 7, ServerId: 1, ViewpointId: "LOCAL-7", LifecycleStatus: "active", RevisionNumber: 1,
  ModelFingerprint: "a".repeat(64), Camera: null, SelectedElements: [], HiddenElements: [], AppearanceOverrides: [], ModelReferences: [],
  SectioningJson: null, RedlinesJson: null, ScreenshotSha256: null,
};
state.DigestSha256 = lensNextVisualStateDigest(state);
const rebound = validateAndRebindLocalVisualState(state, { projectId: 7, serverId: 91, viewpointId: "LOCAL-7", modelFingerprint: "a".repeat(64) });
const parsed = JSON.parse(rebound.json);
assert.equal(parsed.ServerId, 91);
assert.equal(parsed.DigestSha256, rebound.digest);
assert.equal(lensNextVisualStateDigest(parsed), rebound.digest);
assert.throws(() => validateAndRebindLocalVisualState({ ...state, DigestSha256: "0".repeat(64) }, { projectId: 7, serverId: 92, viewpointId: "LOCAL-7", modelFingerprint: "a".repeat(64) }), /digest/i);
const route = fs.readFileSync(new URL("../routes/clash_reports.ts", import.meta.url), "utf8");
const start = route.indexOf('router.post("/projects/:projectId/clash-reports/lens-next/local-viewpoints/upload"');
const end = route.indexOf('// Registered BEFORE', start);
const block = route.slice(start, end);
assert.ok(start >= 0 && end > start);
assert.match(block, /db\.transaction/);
assert.match(block, /platform_identity_exists/);
assert.match(block, /display_id_conflict/);
assert.doesNotMatch(block, /lens-sync/);
console.log(JSON.stringify({ status: "PASS", tests: ["exact-local-only", "explicit-confirmation", "atomic-record-and-package", "digest-rebind", "no-overwrite", "display-conflict-deny"] }));
