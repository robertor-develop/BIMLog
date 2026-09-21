import assert from "node:assert/strict";
import fs from "node:fs";

const read = (relative) =>
  fs.readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");

const meetings = read("artifacts/bimlog/src/pages/project/MeetingsTab.tsx");
const data = read("artifacts/bimlog/src/pages/project/meetings/meeting-data.ts");
const editor = read("artifacts/bimlog/src/pages/project/meetings/meeting-editor-state.ts");
const actions = read("artifacts/bimlog/src/pages/project/meetings/MeetingActionItemsTable.tsx");
const participants = read("artifacts/bimlog/src/pages/project/meetings/MeetingParticipantField.tsx");

for (const modulePath of [
  "./meetings/meeting-data",
  "./meetings/meeting-editor-state",
  "./meetings/MeetingActionItemsTable",
  "./meetings/MeetingParticipantField",
]) {
  assert.match(meetings, new RegExp(modulePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

assert.match(data, /Promise\.all\(\[/, "meeting and action queries remain coordinated");
assert.match(data, /\/projects\/\$\{projectId\}\/meetings/);
assert.match(data, /\/projects\/\$\{projectId\}\/action-items/);
assert.match(data, /Authorization: `Bearer \$\{token\}`/);
assert.doesNotMatch(
  meetings,
  /const \[mr, ar\] = await Promise\.all/,
  "query orchestration must not drift back into the page",
);

assert.match(editor, /agendaReducer/);
assert.match(editor, /MeetingDraftEvent/);
for (const transition of [
  "SAVE_STARTED",
  "SAVE_SUCCEEDED",
  "SAVE_FAILED",
  "RESET",
]) {
  assert.match(editor, new RegExp(transition));
}
assert.match(meetings, /useMeetingAgendaState\(\)/);
assert.match(meetings, /useMeetingDraftMachine\(\)/);

assert.match(actions, /scope="col"/);
assert.match(actions, /overflowX: "auto"/);
assert.match(actions, /minWidth: 680/);
assert.match(actions, /data-meeting-action-id=\{item\.id\}/);
assert.match(actions, /type="button"/);
assert.match(actions, /aria-hidden="true"/);
assert.match(actions, /No action items yet/);
assert.match(actions, /Sin acciones aún/);

assert.match(participants, /aria-label=\{label\}/);
assert.match(participants, /type\?: "text" \| "email" \| "tel"/);
assert.match(meetings, /<MeetingParticipantField[\s\S]{0,120}type="email"/);
assert.match(meetings, /<MeetingParticipantField[\s\S]{0,120}type="tel"/);
assert.equal(
  (meetings.match(/<MeetingParticipantField/g) || []).length,
  4,
  "trade, role, email, and phone fields must use the extracted participant control",
);
assert.match(
  meetings,
  /<MeetingActionItemsTable[\s\S]*onComplete=\{\(id\) => void updateActionItem\(id, "completed"\)\}/,
);

console.log(
  "POST120_BLOCK29=PASS data=isolated editor=state-machine actions=accessible participants=labeled",
);
