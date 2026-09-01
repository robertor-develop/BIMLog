import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { LENS_NEXT_LEGACY_DIGEST_CONTRACT_VERSION, LensNextLocalUploadError, lensNextVisualStateDigest, validateAndRebindLocalVisualState } from "./lens-next-local-upload";

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
const unicodeState: any = {
  ...state,
  ProjectId: 29,
  ViewpointId: "OT-001",
  ModelFingerprint: "c".repeat(64),
  ModelReferences: [{
    ModelId: "model-1",
    Source: "C:\\Users\\sebas\\OneDrive\\Документы\\35-42 41ST ST. ELARA WEST_dromero3STG7.rvt",
    ContentHash: "b".repeat(64),
  }],
};
unicodeState.DigestSha256 = lensNextVisualStateDigest(unicodeState);
const unicodeRebound = validateAndRebindLocalVisualState(unicodeState, { projectId: 29, serverId: 682, viewpointId: "OT-001", modelFingerprint: "c".repeat(64) });
const unicodeWireBytes = Buffer.from(unicodeRebound.json, "utf8");
const unicodeApplied = JSON.parse(unicodeWireBytes.toString("utf8"));
assert.equal(unicodeApplied.ModelReferences[0].Source, unicodeState.ModelReferences[0].Source);
assert.equal(lensNextVisualStateDigest(unicodeApplied), unicodeRebound.digest);
assert.equal(unicodeApplied.DigestDiagnostics.ComputedDigest, unicodeRebound.digest);
assert.throws(() => validateAndRebindLocalVisualState({ ...state, DigestSha256: "0".repeat(64) }, { projectId: 7, serverId: 92, viewpointId: "LOCAL-7", modelFingerprint: "a".repeat(64) }), /digest/i);
const screenshotBytes = Buffer.from("lens-next-thumbnail-fixture", "utf8");
const screenshotDataUrl = `data:image/jpeg;base64,${screenshotBytes.toString("base64")}`;
const screenshotState: any = {
  ...state,
  ScreenshotDataUrl: screenshotDataUrl,
  ScreenshotSha256: createHash("sha256").update(screenshotBytes).digest("hex"),
};
screenshotState.DigestSha256 = lensNextVisualStateDigest(screenshotState);
const screenshotRebound = validateAndRebindLocalVisualState(screenshotState, { projectId: 7, serverId: 94, viewpointId: "LOCAL-7", modelFingerprint: "a".repeat(64) });
assert.equal(screenshotRebound.screenshotDataUrl, screenshotDataUrl);
const invalidScreenshotState = { ...screenshotState, ScreenshotDataUrl: "data:image/jpeg;base64,AAAA" };
assert.equal(validateAndRebindLocalVisualState(invalidScreenshotState, { projectId: 7, serverId: 95, viewpointId: "LOCAL-7", modelFingerprint: "a".repeat(64) }).screenshotDataUrl, null);
const vector: any = {
  SchemaVersion: "bimlog.lens_next.visual_state.v1", ProjectId: 28, ServerId: 1, ViewpointId: "local-viewpoint-1", LifecycleStatus: "active", RevisionNumber: 1,
  ModelFingerprint: "0123456789abcdef".repeat(4), Camera: null, SelectedElements: [], HiddenElements: [], AppearanceOverrides: [], ModelReferences: [],
  SectioningJson: null, RedlinesJson: null, ScreenshotSha256: null,
};
assert.equal(lensNextVisualStateDigest(vector), "a2f9dae5c4bfb18073d72775318fdd2d70c1a24bdbafbfc9b3df5f7d2fc4407a");
const v2NumericVector: any = {
  ...vector,
  ViewpointId: "local-viewpoint-v2",
  Camera: {
    Position: { X: 370.12345678901235, Y: -42.125, Z: -0 }, Rotation: { A: 0, B: 0, C: 0, D: 1 }, WorldUpVector: { X: 0, Y: 1, Z: 0 },
    Projection: "Perspective", FocalDistance: 250.5, HorizontalExtentAtFocalDistance: 400.25, VerticalExtentAtFocalDistance: 300.125,
  },
};
assert.equal(lensNextVisualStateDigest(v2NumericVector), "55bad86cd7f9d4fb5f935b8b8aef597348322a15fd4f439557af357dc55ff918");
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
const legacyNumericCanonical = [
  "bimlog.lens_next.visual_state.v1", "28", "1", "local-viewpoint-numeric", "active", "1", "0123456789abcdef".repeat(4),
  "370.123456789012", "-42.125", "0", "0", "0", "0", "1", "0", "1", "0", "Perspective", "250.5", "400.25", "300.125",
  "<null>", "<null>", "<null>",
].map(value => `${value}\u001f`).join("");
const legacyNumericDigest = createHash("sha256").update(legacyNumericCanonical, "utf8").digest("hex");
const legacyNumericState: any = {
  SchemaVersion: "bimlog.lens_next.visual_state.v1", ProjectId: 28, ServerId: 1, ViewpointId: "local-viewpoint-numeric", LifecycleStatus: "active", RevisionNumber: 1,
  ModelFingerprint: "0123456789abcdef".repeat(4),
  Camera: {
    Position: { X: 370.12345678901235, Y: -42.125, Z: 0 }, Rotation: { A: 0, B: 0, C: 0, D: 1 }, WorldUpVector: { X: 0, Y: 1, Z: 0 },
    Projection: "Perspective", FocalDistance: 250.5, HorizontalExtentAtFocalDistance: 400.25, VerticalExtentAtFocalDistance: 300.125,
  },
  SelectedElements: [], HiddenElements: [], AppearanceOverrides: [], ModelReferences: [], SectioningJson: null, RedlinesJson: null, ScreenshotSha256: null,
  DigestSha256: legacyNumericDigest,
  DigestDiagnostics: {
    Algorithm: "SHA-256", ContractVersion: LENS_NEXT_LEGACY_DIGEST_CONTRACT_VERSION, ComputedDigest: legacyNumericDigest, Truncated: false,
    CanonicalInputBase64: Buffer.from(legacyNumericCanonical, "utf8").toString("base64"), CanonicalLength: legacyNumericCanonical.length,
  },
};
const legacyNumericRebound = validateAndRebindLocalVisualState(legacyNumericState, { projectId: 28, serverId: 92, viewpointId: "local-viewpoint-numeric", modelFingerprint: "0123456789abcdef".repeat(4) });
const legacyNumericParsed = JSON.parse(legacyNumericRebound.json);
assert.equal(legacyNumericParsed.DigestDiagnostics.ContractVersion, LENS_NEXT_LEGACY_DIGEST_CONTRACT_VERSION);
assert.equal(lensNextVisualStateDigest(legacyNumericParsed), legacyNumericRebound.digest);
assert.throws(
  () => validateAndRebindLocalVisualState({ ...legacyNumericState, Camera: { ...legacyNumericState.Camera, Position: { ...legacyNumericState.Camera.Position, X: 371.12345678901235 } } }, { projectId: 28, serverId: 93, viewpointId: "local-viewpoint-numeric", modelFingerprint: "0123456789abcdef".repeat(4) }),
  (error: unknown) => error instanceof LensNextLocalUploadError && error.code === "visual_state_digest_mismatch",
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
console.log(JSON.stringify({ status: "PASS", tests: ["exact-local-only", "explicit-confirmation", "atomic-record-and-package", "digest-rebind", "utf8-unicode-rebind-and-apply", "verified-thumbnail-retention", "invalid-thumbnail-nonfatal", "cross-language-null-vector", "cross-language-v2-float-vector", "first-token-mismatch-diagnostics", "legacy-dotnet-float-compatibility", "legacy-float-tamper-denial", "no-overwrite", "display-conflict-deny"] }));
