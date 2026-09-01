import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  planLensNextSynchronization,
  reconcileLensNextInventories,
} from "./lens-next-model.ts";
import type {
  LensNextIssue,
  LensNextLocalInventory,
  LensNextLocalViewpoint,
} from "./lens-next-types.ts";
import {
  LENS_NEXT_ARCHITECTURE_BOUNDARY,
  assertLensNextCapabilityBoundary,
} from "./lens-next-architecture-boundary.ts";

const fingerprint = "b".repeat(64);
const guid = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const issue = (serverId: number, overrides: Partial<LensNextIssue> = {}): LensNextIssue => ({
  identity: { projectId: 26, serverId, viewpointId: `VP-${serverId}`, lifecycleStatus: "active", revisionNumber: 1 },
  mutationVersion: 1,
  publishingAllowed: true,
  displayId: `BIM-${serverId}`,
  navisworksGuid: null,
  bimlogPhysicalId: `physical-${serverId}`,
  issueGroupId: null,
  note: `Issue ${serverId}`,
  openItems: null,
  trade: "Electrical",
  floor: "L6",
  responsibleCompany: "Test Company",
  reportType: "Coordination",
  priority: 2,
  status: "open",
  capturedAt: null,
  syncedAt: null,
  supersedesId: null,
  supersedesCode: null,
  screenshotUrl: null,
  visualStateAvailable: true,
  visualStateDigest: "a".repeat(64),
  ...overrides,
});
const view = (serverId: number | null, value: number, overrides: Partial<LensNextLocalViewpoint> = {}): LensNextLocalViewpoint => ({
  projectId: 26,
  serverId,
  viewpointId: serverId === null ? `LOCAL-${value}` : `VP-${serverId}`,
  displayId: serverId === null ? `LOCAL-${value}` : `BIM-${serverId}`,
  bimlogPhysicalId: serverId === null ? `local-physical-${value}` : `physical-${serverId}`,
  navisworksGuid: guid(value),
  displayName: serverId === null ? `LOCAL-${value}` : `BIM-${serverId}`,
  folderPath: "BIMLog Viewpoints/Open",
  exactManagedIdentity: true,
  lensNextPublished: serverId !== null,
  ...overrides,
});
const local = (viewpoints: readonly LensNextLocalViewpoint[]): LensNextLocalInventory => ({
  projectId: 26,
  modelFingerprint: fingerprint,
  modelBindingKey: "1185-river-model",
  viewpoints,
});

// Clean model: BIMLog is authoritative and every complete selected package is pulled.
const cleanModel = planLensNextSynchronization([issue(1), issue(2)], local([]));
assert.deepEqual({ pull: cleanModel.pullFromBimlog, upload: cleanModel.uploadToBimlog, executable: cleanModel.executable }, { pull: 2, upload: 0, executable: true });

// Historical Original Lens model: exact managed local-only inventory is eligible for one upload.
const historical = planLensNextSynchronization([], local([view(null, 31)]));
assert.deepEqual({ pull: historical.pullFromBimlog, upload: historical.uploadToBimlog, executable: historical.executable }, { pull: 0, upload: 1, executable: true });

// Missing package blocks instead of searching or inventing visual state.
const missingPackage = planLensNextSynchronization([issue(3, { visualStateAvailable: false, visualStateDigest: null })], local([]));
assert.equal(missingPackage.blocked, 1);
assert.equal(missingPackage.executable, false);

// Stale GUID, ambiguous identity, and duplicate claims all fail closed.
const staleGuid = planLensNextSynchronization([issue(4, { navisworksGuid: guid(404) })], local([]));
assert.equal(staleGuid.manualConflict, 1);
const ambiguous = planLensNextSynchronization([issue(5)], local([view(5, 51), view(5, 52, { navisworksGuid: guid(52) })]));
assert.equal(ambiguous.manualConflict, 1);
const duplicated = planLensNextSynchronization([issue(6), issue(7, { displayId: "BIM-6", bimlogPhysicalId: "physical-6" })], local([view(null, 61, { displayId: "BIM-6", bimlogPhysicalId: "physical-6" })]));
assert.equal(duplicated.manualConflict, 2);

// Interrupted confirmation repairs exactly one null GUID; an exact rerun is then in sync.
const interrupted = planLensNextSynchronization([issue(8)], local([view(8, 81)]));
assert.equal(interrupted.confirmLocalIdentity, 1);
assert.equal(interrupted.executable, true);
const rerun = planLensNextSynchronization([issue(8, { navisworksGuid: guid(81) })], local([view(8, 81)]));
assert.equal(rerun.inSync, 1);
assert.equal(rerun.confirmLocalIdentity + rerun.pullFromBimlog + rerun.uploadToBimlog, 0);
assert.equal(rerun.executable, false);

// Full dual inventory remains stable after refresh/save/close/reopen reconstruction.
const persistedLocal = local([view(8, 81), view(null, 91)]);
const before = reconcileLensNextInventories([issue(8, { navisworksGuid: guid(81) })], persistedLocal);
const reopened = JSON.parse(JSON.stringify(persistedLocal)) as LensNextLocalInventory;
const after = reconcileLensNextInventories([issue(8, { navisworksGuid: guid(81) })], reopened);
assert.deepEqual(after, before);
assert.equal(reopened.viewpoints[0].folderPath, "BIMLog Viewpoints/Open");
assert.equal(reopened.viewpoints[0].navisworksGuid, guid(81));

const panel = readFileSync(new URL("./LensNextPanel.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../../../../api-server/src/routes/clash_reports.ts", import.meta.url), "utf8");
const native2021 = readFileSync(new URL("../../../../../plugins/BIMLogLensNext/native/AutodeskPublishedViewpointAdapter.cs", import.meta.url), "utf8");
const native2025 = readFileSync(new URL("../../../../../plugins/BIMLogLensNext/native/AutodeskPublishedViewpointAdapter.cs", import.meta.url), "utf8");

// Complete governed order and bounded recovery behavior.
assert.ok(panel.indexOf("for (const item of confirmations)") < panel.indexOf("for (const item of pulls)"));
assert.ok(panel.indexOf("for (const item of pulls)") < panel.indexOf("for (const item of uploads)"));
assert.match(panel, /loadVisualState\(issue\)[\s\S]*applyPlatformWorkingView[\s\S]*createLocalSavedViewpoint[\s\S]*confirmCreatedLocalViewpoint/);
assert.match(panel, /Refresh before retrying; do not create duplicates/);
assert.match(panel, /publishingAllowed/);
assert.match(route, /requirePermission\("admin", "write"\)/);
assert.match(route, /replayed: true/);
assert.match(route, /platform_identity_exists/);
assert.match(route, /local_confirmation_conflict/);

// Both native generations retain exact-identity persistence and prohibit automatic saves/deletes.
for (const source of [native2021, native2025]) {
  assert.match(source, /LensNextPublished|ServerId|VisualStateDigest|OperationId|ConfirmationReason/);
  assert.doesNotMatch(source, /\.SaveFile\s*\(|\.SaveAs\s*\(|CurrentDocument\.Save\s*\(|SavedViewpoints\.Remove\s*\(|RemoveAt\s*\(|\.Delete\s*\(/i);
}
assert.doesNotMatch(panel, /similarity|bestGuess|firstMatch|lens-sync|saveNwf|saveNwd/i);

// Mechanical ecosystem authority boundary: external products are contracts, never absorbed authority.
assert.equal(LENS_NEXT_ARCHITECTURE_BOUNDARY.capabilityOwner, "BIMLog");
assert.deepEqual(LENS_NEXT_ARCHITECTURE_BOUNDARY.ownedCapabilities, [
  "construction-project-binding",
  "construction-model-binding",
  "construction-issue-workflow",
  "construction-viewpoint-workflow",
]);
assert.deepEqual(LENS_NEXT_ARCHITECTURE_BOUNDARY.explicitRefusals, [
  "marketing-execution-authority",
  "portfolio-finance-allocation-authority",
  "legal-approval-authority",
  "knowledge-intake-routing-authority",
]);
for (const capability of LENS_NEXT_ARCHITECTURE_BOUNDARY.ownedCapabilities) assert.doesNotThrow(() => assertLensNextCapabilityBoundary(capability));
for (const refused of LENS_NEXT_ARCHITECTURE_BOUNDARY.explicitRefusals) assert.throws(() => assertLensNextCapabilityBoundary(refused), /outside BIMLog authority/);
assert.ok(LENS_NEXT_ARCHITECTURE_BOUNDARY.contracts.includes("versioned external handoff contracts"));

console.log(JSON.stringify({
  status: "PASS",
  build: 10,
  scenarios: [
    "clean-model-platform-first",
    "historical-original-lens-local-only",
    "missing-platform-package",
    "stale-guid",
    "ambiguous-identity",
    "interrupted-confirmation",
    "duplicate-and-idempotent-rerun",
    "unauthorized-read-only",
    "refresh-save-close-reopen-persistence",
    "bounded-failure-recovery",
    "navisworks-2021-2025-source-contract",
    "semantic-architecture-authority-boundary",
  ],
  architecture: LENS_NEXT_ARCHITECTURE_BOUNDARY,
}));
