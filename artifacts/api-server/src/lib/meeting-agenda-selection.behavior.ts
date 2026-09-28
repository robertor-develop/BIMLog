import assert from "node:assert/strict";
import { buildMeetingAgenda } from "./meeting-agenda-selection";

const sources = [
  { tenantId: 31, projectId: 26, kind: "rfi" as const, sourceId: "RFI-10", sourceVersion: 2, title: "Duct routing", status: "open", dueDate: "2026-09-20", sourceUrl: "/projects/26/rfis?rfi=10" },
  { tenantId: 31, projectId: 26, kind: "schedule_task" as const, sourceId: "TASK-2", sourceVersion: 1, title: "Sleeves", status: "in_progress", blocked: true, sourceUrl: "/projects/26/schedule?task=2" },
  { tenantId: 31, projectId: 26, kind: "submittal" as const, sourceId: "SUB-3", sourceVersion: 1, title: "Approved", status: "complete", dueDate: "2026-09-01", sourceUrl: "/projects/26/submittals?submittal=3" },
];
const agenda = buildMeetingAgenda({ tenantId: 31, projectId: 26, meetingId: "M-50", capturedAt: "2026-09-28T14:00:00Z", sources });
assert.deepEqual(agenda.items.map(item => [item.sourceId, item.reason]), [["TASK-2", "blocked"], ["RFI-10", "overdue"]]);
assert.equal(buildMeetingAgenda({ tenantId: 31, projectId: 26, meetingId: "M-50", capturedAt: "2026-09-28T14:00:00Z", sources }).fingerprint, agenda.fingerprint);
assert.throws(() => buildMeetingAgenda({ tenantId: 31, projectId: 26, meetingId: "M-50", capturedAt: "2026-09-28T14:00:00Z", sources: [{ ...sources[0], projectId: 99 }] }), /AGENDA_SOURCE_SCOPE_DENIED/);
console.log("C051 canonical overdue/blocked meeting agenda snapshot: PASS");
