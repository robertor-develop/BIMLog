import assert from "node:assert/strict";
import test from "node:test";
import { buildSmartMeetingAgenda } from "./smart-meeting-agenda";

test("agenda carries every supported unresolved source without cross-kind collisions", () => {
  const agenda = buildSmartMeetingAgenda(31, [
    { kind: "rfi", sourceId: 4, title: "RFI 004", status: "Open" },
    { kind: "submittal", sourceId: 4, title: "Submittal 004", status: "Pending" },
    { kind: "action_item", sourceId: 9, title: "Confirm sleeve", status: "In progress" },
    { kind: "lens_viewpoint", sourceId: 3, title: "PL-027", status: "Follow up" },
    { kind: "attendee", sourceId: 2, title: "Ruben Crespo" },
  ]);
  assert.deepEqual(agenda.map((item) => item.identity), [
    "rfi:4",
    "submittal:4",
    "action_item:9",
    "lens_viewpoint:3",
    "attendee:2",
  ]);
  assert.ok(agenda.every((item) => item.sourceMeetingId === 31));
});

test("agenda excludes terminal and explicitly excluded items", () => {
  const agenda = buildSmartMeetingAgenda(31, [
    { kind: "rfi", sourceId: 1, title: "Closed RFI", status: "Closed" },
    { kind: "submittal", sourceId: 2, title: "Published submittal", status: "Published" },
    { kind: "action_item", sourceId: 3, title: "Omitted by coordinator", status: "Open", excluded: true },
    { kind: "agenda_topic", sourceId: 4, title: "Open topic", status: "Open" },
  ]);
  assert.deepEqual(agenda.map((item) => item.identity), ["agenda_topic:4"]);
});

test("agenda deduplicates stable identities without merging distinct sources", () => {
  const agenda = buildSmartMeetingAgenda(9, [
    { kind: "rfi", sourceId: 7, title: "First snapshot", status: "Open" },
    { kind: "rfi", sourceId: 7, title: "Duplicate snapshot", status: "Open" },
  ]);
  assert.equal(agenda.length, 1);
  assert.equal(agenda[0]?.title, "First snapshot");
});
