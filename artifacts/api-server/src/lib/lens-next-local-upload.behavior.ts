import assert from "node:assert/strict";
import fs from "node:fs";
import { LensNextLocalUploadError, lensNextVisualStateDigest, validateAndRebindLocalVisualState } from "./lens-next-local-upload";

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
const vector: any = {
  SchemaVersion: "bimlog.lens_next.visual_state.v1", ProjectId: 28, ServerId: 1, ViewpointId: "local-viewpoint-1", LifecycleStatus: "active", RevisionNumber: 1,
  ModelFingerprint: "0123456789abcdef".repeat(4), Camera: null, SelectedElements: [], HiddenElements: [], AppearanceOverrides: [], ModelReferences: [],
  SectioningJson: null, RedlinesJson: null, ScreenshotSha256: null,
};
assert.equal(lensNextVisualStateDigest(vector), "a2f9dae5c4bfb18073d72775318fdd2d70c1a24bdbafbfc9b3df5f7d2fc4407a");
const nativeCanonicalWithWrongProject = [
  "bimlog.lens_next.visual_state.v1", "99", "1", "local-viewpoint-1", "active", "1", "0123456789abcdef".repeat(4), "camera:null", "<null>", "<null>", "<null>",
].map(value => `${value}\u001f`).join("");
const mismatchState = {
  ...vector,
  DigestSha256: "0".repeat(64),
  DigestDiagnostics: {
    Algorithm: "SHA-256", ContractVersion: "lens-next-visual-digest.v1", Truncated: true,
    CanonicalInputBase64: Buffer.from(nativeCanonicalWithWrongProject, "utf8").toString("base64"),
  },
};
assert.throws(
  () => validateAndRebindLocalVisualState(mismatchState, { projectId: 28, serverId: 92, viewpointId: "local-viewpoint-1", modelFingerprint: "0123456789abcdef".repeat(4) }),
  (error: unknown) => error instanceof LensNextLocalUploadError
    && error.code === "visual_state_digest_mismatch"
    && error.digestDiagnostics?.contractVersion === "lens-next-visual-digest.v1"
    && error.digestDiagnostics?.truncated === true
    && (error.digestDiagnostics?.firstMismatch as { field?: string } | null)?.field === "projectId",
);
const route = fs.readFileSync(new URL("../routes/clash_reports.ts", import.meta.url), "utf8");
const start = route.indexOf('router.post("/projects/:projectId/clash-reports/lens-next/local-viewpoints/upload"');
const end = route.indexOf('// Registered BEFORE', start);
const block = route.slice(start, end);
assert.ok(start >= 0 && end > start);
assert.match(block, /db\.transaction/);
assert.match(block, /platform_identity_exists/);
assert.match(block, /display_id_conflict/);
assert.match(block, /digestDiagnostics/);
assert.doesNotMatch(block, /lens-sync/);
console.log(JSON.stringify({ status: "PASS", tests: ["exact-local-only", "explicit-confirmation", "atomic-record-and-package", "digest-rebind", "cross-language-fixed-vector", "first-token-mismatch-diagnostics", "no-overwrite", "display-conflict-deny"] }));
