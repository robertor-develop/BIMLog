import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { planLensNextSynchronization } from "./lens-next-model.ts";
import type { LensNextIssue, LensNextLocalInventory } from "./lens-next-types.ts";

const issue = (serverId: number, displayId: string, physical: string, visualStateAvailable = false): LensNextIssue => ({
  identity: { projectId: 26, serverId, viewpointId: `${displayId} | EL-001`, lifecycleStatus: "active", revisionNumber: 1 },
  mutationVersion: 1, publishingAllowed: false, displayId, navisworksGuid: null, bimlogPhysicalId: physical,
  issueGroupId: null, note: null, openItems: null, trade: "Electrical", floor: "L6", responsibleCompany: null,
  reportType: null, priority: 2, status: "open", capturedAt: null, syncedAt: null, supersedesId: null,
  supersedesCode: null, screenshotUrl: null, visualStateAvailable, visualStateDigest: visualStateAvailable ? `digest-${serverId}` : null,
});
const local = (viewpoints: LensNextLocalInventory["viewpoints"]): LensNextLocalInventory => ({
  projectId: 26, modelFingerprint: "a".repeat(64), modelBindingKey: "1185-river-avenue", viewpoints,
});
const view = (serverId: number | null, displayId: string, exactManagedIdentity = true) => ({
  projectId: 26, serverId, viewpointId: displayId, displayId, bimlogPhysicalId: `physical-${displayId}`,
  navisworksGuid: `guid-${displayId}`, displayName: displayId, folderPath: "BIMLog/Open", exactManagedIdentity,
});

const plan = planLensNextSynchronization(
  [issue(1, "A", "physical-A"), issue(2, "B", "physical-B", true), issue(3, "C", "physical-C")],
  local([view(1, "A"), view(null, "D"), view(null, "legacy", false)]),
);
assert.deepEqual({ inSync: plan.inSync, pull: plan.pullFromBimlog, upload: plan.uploadToBimlog, conflict: plan.manualConflict, blocked: plan.blocked, executable: plan.executable },
  { inSync: 1, pull: 1, upload: 1, conflict: 0, blocked: 2, executable: false });
assert.equal(plan.items.find((item) => item.displayId === "B")?.disposition, "pull_from_bimlog");
assert.equal(plan.items.find((item) => item.displayId === "C")?.disposition, "blocked");

const ambiguous = planLensNextSynchronization([issue(9, "X", "physical-X")], local([
  view(9, "X"), { ...view(9, "X-copy"), displayId: "X", bimlogPhysicalId: "physical-X" },
]));
assert.equal(ambiguous.manualConflict, 1);
assert.equal(ambiguous.uploadToBimlog, 0);

const shared = planLensNextSynchronization([issue(10, "Y", "physical-Y"), issue(11, "Y", "physical-Y")], local([view(null, "Y")]));
assert.equal(shared.manualConflict, 2);
assert.equal(shared.inSync, 0);

const selectedOnly = planLensNextSynchronization(
  [issue(21, "SELECTED", "physical-SELECTED", true)],
  local([view(20, "FILTERED-OUT")]),
  [issue(20, "FILTERED-OUT", "physical-FILTERED-OUT"), issue(21, "SELECTED", "physical-SELECTED", true)],
);
assert.equal(selectedOnly.pullFromBimlog, 1);
assert.equal(selectedOnly.uploadToBimlog, 0, "a local match outside the current platform selection must not be misclassified as local-only");
const viewSource = readFileSync(new URL("./LensNextPanelView.tsx", import.meta.url), "utf8");
const styleSource = readFileSync(new URL("./lens-next-panel.css", import.meta.url), "utf8");
assert.match(viewSource, /Review synchronization plan/);
assert.match(viewSource, /preview is read-only · no synchronization has run/);
const syncPlanStyle = styleSource.match(/\.lens-next__sync-plan ol\{([^}]*)\}/)?.[1] ?? "";
assert.doesNotMatch(syncPlanStyle, /overflow|max-height/, "the plan must use the existing whole-panel scrollbar");
console.log("PASS Lens Next Build 3 platform-first synchronization plan");
