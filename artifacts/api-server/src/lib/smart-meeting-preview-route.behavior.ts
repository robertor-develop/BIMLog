import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("carry-forward preview is authenticated, project scoped, and read only", async () => {
  const route = await readFile(new URL("../routes/meeting_minutes.ts", import.meta.url), "utf8");
  const marker = '"/projects/:projectId/meetings/:meetingId/carry-forward-preview"';
  const start = route.indexOf(marker);
  const end = route.indexOf("// ── POST /projects/:projectId/meetings", start);
  assert.ok(start > 0 && end > start);
  const preview = route.slice(start, end);
  assert.match(preview, /authMiddleware/);
  assert.match(preview, /requireProjectMember\(\)/);
  assert.match(preview, /eq\(meetingMinutesTable\.projectId, projectId\)/);
  assert.match(preview, /buildSmartMeetingAgenda/);
  assert.doesNotMatch(preview, /\.insert\(|\.update\(|\.delete\(/);
});
