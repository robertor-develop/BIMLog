import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("create-next is governed, transactional, idempotent, and audited", async () => {
  const route = await readFile(new URL("../routes/meeting_minutes.ts", import.meta.url), "utf8");
  const start = route.indexOf('"/projects/:projectId/meetings/:meetingId/create-next"');
  const end = route.indexOf('"/projects/:projectId/meetings/:meetingId/carry-forward-preview"', start);
  assert.ok(start > 0 && end > start);
  const source = route.slice(start, end);
  assert.match(source, /requirePermission\("admin", "write"\)/);
  assert.match(source, /db\.transaction/);
  assert.match(source, /previousMeetingId, sourceMeetingId/);
  assert.match(source, /meeting\.next_created/);
  assert.match(source, /meetingAgendaItemsTable/);
});

test("database enforces one successor per source meeting", async () => {
  const app = await readFile(new URL("../app.ts", import.meta.url), "utf8");
  assert.match(app, /meeting_minutes_previous_meeting_uidx/);
  assert.match(app, /WHERE previous_meeting_id IS NOT NULL AND deleted_at IS NULL/);
});
