import assert from "node:assert/strict";
import { projectResponsibilityItems } from "./responsibility-workspace";
import type { CoordinatorActionItem } from "./coordinator-action-register";

const action: CoordinatorActionItem = {
  key: "rfi:17",
  sourceModule: "rfi",
  sourceId: 17,
  projectId: 9,
  displayIdentifier: "RFI-017",
  originalStatus: "open",
  presentationStatus: "action_required",
  title: "Confirm sleeve elevation",
  responsibility: { company: "BIMTECH CORP", person: "Ruben", userId: 31 },
  dueAt: "2026-09-30T17:00:00.000Z",
  deadlineState: "due_this_week",
  floor: "L02",
  discipline: "Mechanical",
  priority: "P2",
  sourceUpdatedAt: "2026-09-27T12:00:00.000Z",
  internalLink: "/projects/9/rfis?record=17",
  related: {
    meetings: [],
    schedule: [],
    lens: {
      serverId: 44,
      displayId: "CL-044",
      viewpointId: "vp-44",
      navisworksGuid: null,
      bimlogPhysicalId: null,
      lifecycleStatus: "active",
      revisionNumber: 1,
      supersedesId: null,
      issueGroupId: null,
      sourceProjectId: 9,
      sourceServerId: null,
      sourcePhysicalId: null,
      sourceDisplayLabel: null,
      importedLineageStatus: null,
    },
  },
};

const rows = projectResponsibilityItems({
  project: { id: 9, name: "Hospital", code: "HSP" },
  actions: [action, { ...action, key: "duplicate-view" }],
});
assert.equal(rows.length, 1, "one canonical source must be represented once");
assert.deepEqual(rows[0]?.sourceIdentity, { module: "rfi", recordId: 17 });
assert.equal(rows[0]?.owner.userId, 31);
assert.equal(rows[0]?.authorizedLink, "/projects/9/rfis?record=17");
assert.equal(rows[0]?.lensEvidence?.authorizedLink, "/projects/9/clash-reports?view=lens&viewpoint=44");
assert.deepEqual(rows[0]?.contextGaps, []);

const missing = projectResponsibilityItems({
  project: { id: 9, name: "", code: "" },
  actions: [{ ...action, sourceId: 18, dueAt: null, responsibility: { company: null, person: null, userId: null } }],
})[0]!;
assert.deepEqual(missing.contextGaps, ["OWNER_MISSING", "DEADLINE_MISSING", "PROJECT_CONTEXT_MISSING"]);
assert.throws(() => projectResponsibilityItems({
  project: { id: 9, name: "Hospital", code: "HSP" },
  actions: [{ ...action, internalLink: "/projects/10/rfis?record=17" }],
}));

console.log("C026 pending responsibility projection: PASS");
