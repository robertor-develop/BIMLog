import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { planLensNextSynchronization } from "./lens-next-model.ts";
import type { LensNextIssue, LensNextLocalInventory } from "./lens-next-types.ts";

const issue = (serverId: number, navisworksGuid: string | null = null): LensNextIssue => ({
  identity: { projectId: 26, serverId, viewpointId: `VP-${serverId}`, lifecycleStatus: "active", revisionNumber: 2 },
  mutationVersion: 1, publishingAllowed: true, displayId: `BIM-${serverId}`, navisworksGuid, bimlogPhysicalId: `physical-${serverId}`,
  issueGroupId: null, note: null, openItems: null, trade: "Electrical", floor: "L6", responsibleCompany: null,
  reportType: "Coordination", priority: 2, status: "open", capturedAt: null, syncedAt: null, supersedesId: null,
  supersedesCode: null, screenshotUrl: null, visualStateAvailable: true, visualStateDigest: "a".repeat(64),
});
const local: LensNextLocalInventory = { projectId: 26, modelFingerprint: "b".repeat(64), modelBindingKey: "model", viewpoints: [] };

const executable = planLensNextSynchronization([issue(1)], local);
assert.equal(executable.pullFromBimlog, 1);
assert.equal(executable.executable, true);
const stale = planLensNextSynchronization([issue(2, "stale-guid")], local);
assert.equal(stale.manualConflict, 1);
assert.equal(stale.executable, false);

const panel = readFileSync(new URL("./LensNextPanel.tsx", import.meta.url), "utf8");
const pullLoop = panel.indexOf("for (const item of pulls)");
const uploadLoop = panel.indexOf("for (const item of uploads)");
assert.ok(pullLoop > 0 && uploadLoop > pullLoop, "BIMLog pulls must execute before Navisworks uploads");
assert.match(panel, /manualConflict > 0 \|\| synchronizationPlan\.blocked > 0/);
assert.match(panel, /loadVisualState\(issue\)[\s\S]*applyPlatformWorkingView[\s\S]*publishCreatedViewpoint[\s\S]*confirmCreatedLocalViewpoint/);
assert.match(panel, /captureLocalViewpoint\(viewpoint[\s\S]*uploadLocalViewpoint\(viewpoint/);
assert.doesNotMatch(panel, /lens-sync|saveNwf|saveNwd/i);

console.log("PASS Lens Next Build 8 confirmed platform-first reconciliation");
