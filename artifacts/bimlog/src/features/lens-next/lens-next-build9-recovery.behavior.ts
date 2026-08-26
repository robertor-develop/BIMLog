import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { planLensNextSynchronization } from "./lens-next-model.ts";
import type { LensNextIssue, LensNextLocalInventory } from "./lens-next-types.ts";

const issue = (navisworksGuid: string | null): LensNextIssue => ({
  identity: { projectId: 26, serverId: 91, viewpointId: "VP-91", lifecycleStatus: "active", revisionNumber: 3 },
  mutationVersion: 2, publishingAllowed: true, displayId: "EL-091", navisworksGuid, bimlogPhysicalId: "physical-91",
  issueGroupId: null, note: null, openItems: null, trade: "Electrical", floor: "L6", responsibleCompany: null,
  reportType: "Coordination", priority: 2, status: "open", capturedAt: null, syncedAt: null, supersedesId: null,
  supersedesCode: null, screenshotUrl: null, visualStateAvailable: true, visualStateDigest: "c".repeat(64),
});
const local = (guid: string): LensNextLocalInventory => ({ projectId: 26, modelFingerprint: "d".repeat(64), modelBindingKey: "model", viewpoints: [{ projectId: 26, serverId: 91, viewpointId: "VP-91", displayId: "EL-091", bimlogPhysicalId: "physical-91", navisworksGuid: guid, displayName: "EL-091", folderPath: "BIMLog Lens Next", exactManagedIdentity: true }] });

const recovery = planLensNextSynchronization([issue(null)], local("11111111-1111-4111-8111-111111111111"));
assert.equal(recovery.confirmLocalIdentity, 1);
assert.equal(recovery.executable, true);
const mismatch = planLensNextSynchronization([issue("22222222-2222-4222-8222-222222222222")], local("11111111-1111-4111-8111-111111111111"));
assert.equal(mismatch.manualConflict, 1);
assert.equal(mismatch.executable, false);

const panel = readFileSync(new URL("./LensNextPanel.tsx", import.meta.url), "utf8");
assert.ok(panel.indexOf("for (const item of confirmations)") < panel.indexOf("for (const item of pulls)"));
assert.match(panel, /Refresh before retrying; do not create duplicates/);
const route = readFileSync(new URL("../../../../api-server/src/routes/clash_reports.ts", import.meta.url), "utf8");
assert.match(route, /lens_next_local_identity_confirmed/);
assert.match(route, /replayed: true/);
assert.match(route, /confirmationReason\.length < 3/);

console.log("PASS Lens Next Build 9 interrupted-confirmation recovery and audit");
