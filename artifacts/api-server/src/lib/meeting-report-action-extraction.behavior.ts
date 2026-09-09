import assert from "node:assert/strict";
import { extractMeetingReportActions } from "./meeting-report-action-extraction";

const input = { meetingId: "meeting-1", meetingRevision: 2, projectId: 7, companyId: 3, reportSnapshotDigest: "a".repeat(64), capturedAt: "2026-09-09T15:00:00Z", actions: [{ key: "A-01", title: "Issue corrected model", description: null, tradeId: 9, owner: { kind: "user", id: "11", displayName: "Coordinator", email: null }, assignee: { kind: "contact", id: "30", displayName: "Trade contact", email: "trade@example.com" }, dueAt: "2026-09-12T17:00:00Z", visibility: "project" }] } as const;
const actions = extractMeetingReportActions(input);
assert.equal(actions.length, 1);
assert.equal(actions[0]?.status, "proposed");
assert.equal(actions[0]?.source.recordId, "meeting-1:A-01");
assert.throws(() => extractMeetingReportActions({ ...input, actions: [input.actions[0], input.actions[0]] }));
assert.throws(() => extractMeetingReportActions({ ...input, actions: [{ ...input.actions[0], visibility: "external", assignee: null }] }));
console.log("meeting report action extraction behavior: PASS");
