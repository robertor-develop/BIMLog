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
  displayName: "model.nwd", bindingSource: "platform-binding", managedViewpointCount: 1,
};

const calls: string[] = [];
const requestedModelFingerprints: Array<string | null | undefined> = [];
const visualState = {
  ContractVersion: "lens-next-navigation.v1",
  DigestSha256: digest,
  ModelFingerprint: context.modelFingerprint,
  Camera: { Position: { X: 1, Y: 2, Z: 3 }, Rotation: { A: 0, B: 0, C: 0, D: 1 } },
  SelectedElements: [{ ModelIndex: 0, InstanceGuid: "selected" }],
  HiddenElements: [{ ModelIndex: 0, InstanceGuid: "hidden" }],
  AppearanceOverrides: [{ ModelIndex: 0, InstanceGuid: "colored" }],
  ModelReferences: [{ ModelIndex: 0, SourcePath: "model.nwd" }],
  SectioningJson: "{\"Enabled\":true}",
};
let appliedVisualStateJson: string | null = null;
let continuityConfirmedAtBridge = false;
const dependencies: any = {
  apiClient: {
    loadVisualState: async (_issue: unknown, modelFingerprint?: string | null) => { calls.push("load"); requestedModelFingerprints.push(modelFingerprint); return { visualStateJson: JSON.stringify(visualState), visualStateDigest: digest }; },
    saveVisualState: async () => { calls.push("save"); },
  },
  bridgeClient: {
    captureCurrentVisualState: async () => { calls.push("capture"); return { visualStateJson: JSON.stringify({ DigestSha256: digest }), visualStateDigest: digest }; },
    applyPlatformWorkingView: async (_issue: unknown, _context: unknown, json: string, _digest: string, _signal: unknown, confirmed: boolean) => { calls.push("apply-platform"); appliedVisualStateJson = json; continuityConfirmedAtBridge = confirmed; },
  },
};

await openBimlogWorkingView(dependencies, issue(true), context);
assert.deepEqual(calls.splice(0), ["load", "apply-platform"]);
assert.deepEqual(requestedModelFingerprints.splice(0), [context.modelFingerprint]);
assert.deepEqual(JSON.parse(appliedVisualStateJson!), visualState);
assert.equal(continuityConfirmedAtBridge, false);

const changedModel = { ...context, modelFingerprint: "c".repeat(64) };
await assert.rejects(() => openBimlogWorkingView(dependencies, issue(true), changedModel), /continuity was not confirmed/);
assert.deepEqual(calls.splice(0), ["load"]);
let confirmationCalls = 0;
await openBimlogWorkingView({ ...dependencies, confirmLegacyModelContinuity: () => { confirmationCalls++; return true; } }, issue(true), changedModel);
assert.equal(confirmationCalls, 1);
assert.equal(continuityConfirmedAtBridge, true);
assert.deepEqual(calls.splice(0), ["load", "apply-platform"]);
await assert.rejects(() => openBimlogWorkingView({ ...dependencies, confirmLegacyModelContinuity: () => false }, issue(true), changedModel), /continuity was not confirmed/);
assert.deepEqual(calls.splice(0), ["load"]);
requestedModelFingerprints.splice(0);

const legacyWithoutGuid = { ...issue(false), navisworksGuid: null };
await assert.rejects(
  () => openBimlogWorkingView(dependencies, legacyWithoutGuid, context),
  /BIMLog is the source of truth.*no stored visual package.*Open is blocked/,
);
assert.deepEqual(calls.splice(0), []);

const repaired = await repairBimlogWorkingViewFromCurrent(dependencies, legacyWithoutGuid, context);
assert.equal(repaired.visualStateDigest, digest);
assert.deepEqual(calls.splice(0), ["capture", "save", "load", "apply-platform"]);
assert.deepEqual(requestedModelFingerprints.splice(0), [context.modelFingerprint]);

await assert.rejects(() => openBimlogWorkingView(dependencies, issue(false), { ...context, projectId: 99 }), /not bound/);
assert.deepEqual(calls, []);
console.log("PASS Lens Next platform-first full-payload open, blocked missing state, and explicit repair");
