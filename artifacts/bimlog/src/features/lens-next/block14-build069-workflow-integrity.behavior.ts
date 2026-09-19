import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applyLensNextRefreshResponse,
  createLensNextAutoRefreshState,
  startLensNextAutoRefresh,
} from "./lens-next-auto-refresh";
import { planLensNextSynchronization } from "./lens-next-model";
import type { LensNextIssue, LensNextLocalInventory } from "./lens-next-types";

const identity = {
  projectId: 29,
  issueFamilyId: "11111111-1111-4111-8111-111111111111",
  serverId: 7,
  viewpointId: "viewpoint-0007",
  lifecycleStatus: "active" as const,
  revisionNumber: 2,
};
const initial = createLensNextAutoRefreshState({ identity, version: 4, visualStateDigest: "a".repeat(64), issueCount: 1, issueSetDigest: "b".repeat(64) });
const started = startLensNextAutoRefresh(initial, { sessionId: "session-00000001", projectId: 29, credentialVersion: 3, active: true, ephemeralInMemory: true }, 1000, "request-00000001");
assert.equal(started.started, true);
if (!started.started) throw new Error("refresh did not start");
const stale = applyLensNextRefreshResponse(started.state, { requestId: started.request.requestId, identity: { ...identity, revisionNumber: 1 }, version: 3, visualStateDigest: "a".repeat(64), issueCount: 1, issueSetDigest: "b".repeat(64), responseFingerprint: "c".repeat(64) });
assert.equal(stale.mode, "conflict");
assert.equal(stale.reason, "STALE_REFRESH_RESPONSE");
assert.equal(stale.version, 4);
assert.equal(stale.issueSetDigest, "b".repeat(64));

const issue: LensNextIssue = {
  identity: { projectId: 29, serverId: 7, viewpointId: "viewpoint-0007", lifecycleStatus: "active", revisionNumber: 2 },
  mutationVersion: 4, publishingAllowed: true, displayId: "BIM-007", navisworksGuid: "22222222-2222-4222-8222-222222222222", bimlogPhysicalId: "physical-0007", issueGroupId: null,
  note: "Exact clash issue", openItems: null, trade: "MEP", floor: "L02", responsibleCompany: "Acme MEP", reportType: "Coordination", priority: 2, status: "open",
  capturedAt: null, syncedAt: null, supersedesId: null, supersedesCode: null, screenshotUrl: null, visualStateAvailable: true, visualStateDigest: "a".repeat(64),
};
const local: LensNextLocalInventory = { projectId: 29, modelFingerprint: "d".repeat(64), modelBindingKey: "model-29", viewpoints: [{ projectId: 29, serverId: 7, viewpointId: "viewpoint-0007", displayId: "BIM-007", bimlogPhysicalId: "physical-0007", navisworksGuid: "33333333-3333-4333-8333-333333333333", displayName: "BIM-007", folderPath: "BIMLog Lens Next", exactManagedIdentity: true }] };
const conflict = planLensNextSynchronization([issue], local);
assert.equal(conflict.manualConflict, 1);
assert.equal(conflict.executable, false);

const client = readFileSync(new URL("./lens-next-client.ts", import.meta.url), "utf8");
const panel = readFileSync(new URL("./LensNextPanel.tsx", import.meta.url), "utf8");
const workingView = readFileSync(new URL("./lens-next-working-view.ts", import.meta.url), "utf8");
assert.match(client, /idempotencyKey/);
assert.match(panel, /captureNewIssueNavigationView[\s\S]*apiClient\.createIssue/);
assert.match(panel, /for \(const item of confirmations\)[\s\S]*for \(const item of pulls\)[\s\S]*for \(const item of uploads\)/);
assert.match(workingView, /apiClient\.loadVisualState[\s\S]*bridgeClient\.applyPlatformWorkingView/);
assert.match(workingView, /captureCurrentVisualState[\s\S]*saveVisualState[\s\S]*loadVisualState/);

console.log("block 14 build 069 Lens Next workflow integrity: PASS");
