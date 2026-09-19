import assert from "node:assert/strict";
import {
  bindCoordinationEvidence,
  coordinationExportModel,
  coordinationRegisterView,
  reconcileCoordinationLinks,
  transitionCoordinationRecord,
  type CoordinationRecordIdentity,
  type CoordinationRegisterRow,
} from "./construction-coordination-records";

const projectId = 53;
const occurredAt = "2026-09-19T23:00:00.000Z";
const records: CoordinationRecordIdentity[] = [
  { projectId, type: "issue", id: 101, version: 3 },
  { projectId, type: "rfi", id: 201, version: 2 },
  { projectId, type: "submittal", id: 301, version: 1 },
  { projectId, type: "transmittal", id: 401, version: 1 },
  { projectId, type: "meeting", id: 501, version: 2 },
  { projectId, type: "schedule", id: 601, version: 0 },
  { projectId, type: "change_order", id: 701, version: 1 },
];
const [issue, rfi, submittal, transmittal, meeting, schedule, changeOrder] = records;
const graph = reconcileCoordinationLinks(records, [
  { projectId, from: issue, to: rfi, relation: "raised_as" },
  { projectId, from: rfi, to: submittal, relation: "answered_by" },
  { projectId, from: submittal, to: transmittal, relation: "issued_with" },
  { projectId, from: rfi, to: meeting, relation: "reviewed_at" },
  { projectId, from: issue, to: schedule, relation: "affects" },
  { projectId, from: rfi, to: changeOrder, relation: "cost_impact" },
]);
assert.equal(graph.records.length, 7);
assert.equal(graph.links.length, 6);

const issueResolved = transitionCoordinationRecord({ identity: issue, status: "open", action: "resolve", actorUserId: 11, occurredAt });
const issueClosed = transitionCoordinationRecord({ identity: issue, status: issueResolved.status, action: "close", actorUserId: 11, occurredAt, history: issueResolved.history });
const rfiOpened = transitionCoordinationRecord({ identity: rfi, status: "draft", action: "submit", actorUserId: 11, occurredAt });
const rfiResponded = transitionCoordinationRecord({ identity: rfi, status: rfiOpened.status, action: "respond", actorUserId: 12, occurredAt, history: rfiOpened.history });
const rfiClosed = transitionCoordinationRecord({ identity: rfi, status: rfiResponded.status, action: "close", actorUserId: 11, occurredAt, history: rfiResponded.history });
assert.equal(issueClosed.status, "closed");
assert.equal(rfiClosed.status, "closed");
assert.deepEqual(rfiClosed.history.map((entry) => entry.actorUserId), [11, 12, 11]);

const response = bindCoordinationEvidence({
  identity: rfi,
  evidence: { id: "formal-response-v2", kind: "attachment", value: "RFI-201-response.pdf", contentSha256: "b".repeat(64), actorUserId: 12, createdAt: occurredAt },
  responsibleUserIds: [11, 13],
});
const comment = bindCoordinationEvidence({
  identity: rfi,
  evidence: { id: "closure-comment", kind: "comment", value: "Response accepted and issue closed", contentSha256: null, actorUserId: 11, createdAt: occurredAt },
  existing: response.evidence,
  responsibleUserIds: [12, 13],
});
assert.equal(comment.evidence.length, 2);
assert.equal(response.notification?.recordVersion, 2);
assert.deepEqual(comment.notification?.recipients, [12, 13]);

const registerRows: CoordinationRegisterRow[] = records.map((identity, index) => ({
  identity,
  number: ["ISS-101", "RFI-201", "SUB-301", "TRN-401", "MTG-501", "SCH-601", "CO-701"][index],
  title: ["Sleeve conflict", "Sleeve clearance response", "Sleeve submittal", "Formal issuance", "Coordination review", "Opening activity", "Opening cost impact"][index],
  status: identity.type === "issue" || identity.type === "rfi" ? "closed" : "open",
  responsibleCompany: "Acme MEP",
  updatedAt: occurredAt,
}));
const viewResult = coordinationRegisterView({ rows: registerRows, view: {
  id: "scenario-061-065", projectId, name: "Coordination closure scenario",
  filters: { types: [], statuses: [], responsibleCompanies: ["Acme MEP"], search: "" },
  sort: "number_asc", pageSize: 10,
}, page: 1 });
const exported = coordinationExportModel(viewResult);
assert.equal(exported.totalRows, 7);
assert.equal(exported.rows.length, viewResult.visibleRows.length);
for (const record of records) assert.match(exported.csv, new RegExp(`${projectId}:${record.type}:${record.id}`));
assert.ok([...issueClosed.history, ...rfiClosed.history].every((entry) => entry.actorUserId > 0 && Number.isFinite(Date.parse(entry.occurredAt))));
assert.ok(comment.evidence.every((entry) => entry.recordKey === "53:rfi:201" && entry.recordVersion === 2));

console.log("block 13 build 065 multi-record coordination acceptance: PASS");
