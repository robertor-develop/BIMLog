import assert from "node:assert/strict";
import {
  formatMeetingReportDate,
  meetingActionCommandSchema,
  meetingCreateCommandSchema,
  meetingCurrentViewSectionLabel,
  meetingUpdateCommandSchema,
  parseMeetingCurrentViewQuery,
  safeMeetingReportText,
} from "./meeting-minute-contracts";

const created = meetingCreateCommandSchema.parse({
  title: " Weekly coordination ",
  meeting_date: "2026-09-21T14:00:00.000Z",
  attendees: [{ full_name: "Roberto Rodriguez", external_email: "roberto@example.com" }],
  rfi_ids: [1, 2],
});
assert.equal(created.title, "Weekly coordination");
assert.throws(() => meetingCreateCommandSchema.parse({ title: "", meeting_date: "bad" }));

const updated = meetingUpdateCommandSchema.parse({
  title: "Updated title",
  expected_updated_at: "2026-09-21T14:30:00.000Z",
});
assert.equal(updated.title, "Updated title");

const action = meetingActionCommandSchema.parse({
  items: [{ description: "Issue coordinated response", due_date: "2026-09-30" }],
});
assert.equal(action.items.length, 1);
assert.throws(() => meetingActionCommandSchema.parse({ items: [] }));

const actionView = parseMeetingCurrentViewQuery({ view: "actions", lang: "es" });
assert.equal(actionView.language, "es");
assert.deepEqual([...actionView.sections], ["summary", "actions"]);
const boundedSections = parseMeetingCurrentViewQuery({
  sections: "meetings,unknown,linked_records,meetings",
});
assert.deepEqual([...boundedSections.sections], ["meetings", "linked_records"]);
assert.equal(meetingCurrentViewSectionLabel("actions", "es"), "Acciones");
assert.equal(safeMeetingReportText("  coordinated   record "), "coordinated record");
assert.equal(formatMeetingReportDate("not-a-date"), "—");

console.log("POST120_BUILD166=PASS commands=separated queries=separated rendering=separated");
