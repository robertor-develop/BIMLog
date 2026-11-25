import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("series routes are project scoped, governed, validated, and audited", async () => {
  const route = await readFile(new URL("../routes/meeting_minutes.ts", import.meta.url), "utf8");
  const start = route.indexOf('"/projects/:projectId/meeting-series"');
  const end = route.indexOf('"/projects/:projectId/meetings/submittal-candidates"', start);
  assert.ok(start > 0 && end > start);
  const source = route.slice(start, end);
  assert.match(source, /requireProjectMember\(\)/);
  assert.match(source, /requirePermission\("admin", "write"\)/);
  assert.match(source, /normalizeSmartMeetingSeries/);
  assert.match(source, /eq\(meetingSeriesTable\.projectId, projectId\)/);
  assert.match(source, /meeting_series\.created/);
  assert.match(source, /meeting_series_name_exists/);
});
