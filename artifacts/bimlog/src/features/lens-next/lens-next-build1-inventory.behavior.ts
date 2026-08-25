import assert from "node:assert/strict";
import { reconcileLensNextInventories } from "./lens-next-model.ts";
import type { LensNextIssue, LensNextLocalInventory } from "./lens-next-types.ts";

const issue = (serverId: number, displayId: string, physical: string): LensNextIssue => ({
  identity: { projectId: 26, serverId, viewpointId: `${displayId} | EL-001`, lifecycleStatus: "active", revisionNumber: 1 },
  mutationVersion: 1, publishingAllowed: false, displayId, navisworksGuid: null, bimlogPhysicalId: physical,
  issueGroupId: null, note: null, openItems: null, trade: null, floor: null, responsibleCompany: null,
  reportType: null, priority: null, status: "open", capturedAt: null, syncedAt: null, supersedesId: null,
  supersedesCode: null, screenshotUrl: null, visualStateAvailable: false, visualStateDigest: null,
});
const local: LensNextLocalInventory = {
  projectId: 26, modelFingerprint: "a".repeat(64), modelBindingKey: "1185ri-model", viewpoints: [
    { projectId: 26, serverId: 1, viewpointId: "A", displayId: "A", bimlogPhysicalId: "p-a", navisworksGuid: "g-a", displayName: "A", folderPath: "BIMLog/Open", exactManagedIdentity: true },
    { projectId: 26, serverId: null, viewpointId: "B", displayId: "B", bimlogPhysicalId: "p-b", navisworksGuid: "g-b", displayName: "B", folderPath: "BIMLog/Open", exactManagedIdentity: true },
    { projectId: 26, serverId: null, viewpointId: "legacy", displayId: null, bimlogPhysicalId: null, navisworksGuid: "g-c", displayName: "legacy", folderPath: "BIMLog", exactManagedIdentity: false },
  ],
};
assert.deepEqual(reconcileLensNextInventories([issue(1, "A", "p-a"), issue(3, "C", "p-c")], local), {
  matched: 1, platformOnly: 1, navisworksOnly: 1, conflicted: 0, unresolved: 1,
});
assert.deepEqual(reconcileLensNextInventories([], local), {
  matched: 0, platformOnly: 0, navisworksOnly: 2, conflicted: 0, unresolved: 1,
});
console.log("PASS Lens Next Build 1 read-only dual inventory classification");
