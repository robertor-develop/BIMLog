import assert from "node:assert/strict";
import { openBimlogWorkingView, repairBimlogWorkingViewFromCurrent } from "./lens-next-working-view";
import type { LensNextIssue, LensNextBridgeProjectContext } from "./lens-next-types";

const digest = "a".repeat(64);
const issue = (packaged: boolean): LensNextIssue => ({
  identity: { projectId: 35, serverId: 7, viewpointId: "VP-7", lifecycleStatus: "active", revisionNumber: 1 },
  displayId: "VP-7", bimlogPhysicalId: "P-7", navisworksGuid: "11111111-1111-4111-8111-111111111111", issueGroupId: null,
  mutationVersion: 1, status: "open", trade: "Mechanical", floor: "L2", priority: 2,
  note: "Exact historical view", responsibleCompany: null, reportType: null, openItems: null,
  capturedAt: null, syncedAt: null, supersedesId: null, supersedesCode: null, screenshotUrl: null,
  visualStateAvailable: packaged, visualStateDigest: packaged ? digest : null, publishingAllowed: true,
});
const context: LensNextBridgeProjectContext = {
  sessionId: "session", projectId: 35, modelFingerprint: "b".repeat(64), modelBindingKey: "model",
  displayName: "model.nwd", bindingSource: "bimlog_model_registry", managedViewpointCount: 1,
};

const calls: string[] = [];
const dependencies: any = {
  apiClient: {
    loadVisualState: async () => { calls.push("load"); return { visualStateJson: JSON.stringify({ DigestSha256: digest }), visualStateDigest: digest }; },
    saveVisualState: async () => { calls.push("save"); },
  },
  bridgeClient: {
    captureCurrentVisualState: async () => { calls.push("capture"); return { visualStateJson: JSON.stringify({ DigestSha256: digest }), visualStateDigest: digest }; },
    applyPlatformWorkingView: async () => { calls.push("apply-platform"); },
  },
};

await openBimlogWorkingView(dependencies, issue(true), context);
assert.deepEqual(calls.splice(0), ["load", "apply-platform"]);

const legacyWithoutGuid = { ...issue(false), navisworksGuid: null };
await assert.rejects(
  () => openBimlogWorkingView(dependencies, legacyWithoutGuid, context),
  /BIMLog is the source of truth.*no stored visual package.*Open is blocked/,
);
assert.deepEqual(calls.splice(0), []);

const repaired = await repairBimlogWorkingViewFromCurrent(dependencies, legacyWithoutGuid, context);
assert.equal(repaired.visualStateDigest, digest);
assert.deepEqual(calls.splice(0), ["capture", "save", "load", "apply-platform"]);

await assert.rejects(() => openBimlogWorkingView(dependencies, issue(false), { ...context, projectId: 99 }), /not bound/);
assert.deepEqual(calls, []);
console.log("PASS Lens Next platform-first open, blocked missing state, and explicit repair");
