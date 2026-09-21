import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  filterMeetingCurrentView,
  meetingCurrentViewScopeSummary,
  parseMeetingCurrentViewScope,
} from "./meeting-current-view-scope";

const scope = parseMeetingCurrentViewScope({
  q: "duct",
  from: "2026-09-01",
  to: "2026-09-30",
  action_status: "open",
});
const meetings = [
  { title: "Duct coordination", notes: "", location: "Site", meetingDate: "2026-09-10T10:00:00Z" },
  { title: "Plumbing coordination", notes: "", location: "Site", meetingDate: "2026-09-11T10:00:00Z" },
];
const actions = [
  { description: "Resolve duct clearance", assignedToName: "MEP", status: "open", createdAt: "2026-09-10T11:00:00Z" },
  { description: "Resolve duct support", assignedToName: "MEP", status: "completed", createdAt: "2026-09-10T11:00:00Z" },
];
const filtered = filterMeetingCurrentView(meetings, actions, scope);
assert.equal(filtered.meetings.length, 1);
assert.equal(filtered.actions.length, 1);
assert.equal(filtered.actions[0].status, "open");
assert.deepEqual(meetingCurrentViewScopeSummary(scope), {
  q: "duct",
  from: "2026-09-01T00:00:00.000Z",
  to: "2026-09-30T23:59:59.999Z",
  actionStatus: "open",
});
assert.throws(() => parseMeetingCurrentViewScope({ from: "2026-10-01", to: "2026-09-01" }), /meeting_view_date_range_invalid/);

const route = await readFile(new URL("../routes/meeting_minutes.ts", import.meta.url), "utf8");
assert.match(route, /meetings\/current-view\/xlsx/);
assert.match(route, /book_append_sheet\(workbook, meetingSheet, "Meetings"\)/);
assert.match(route, /book_append_sheet\(workbook, actionSheet, "Actions"\)/);
assert.match(route, /book_append_sheet\(workbook, activitySheet, "Activity History"\)/);
assert.match(route, /eq\(activityLogTable\.projectId, projectId\)/);
assert.ok((route.match(/filterMeetingCurrentView\(/g) ?? []).length >= 4);

console.log("POST120_BUILD168=PASS live=aligned pdf=aligned excel=aligned activity=project_scoped");
