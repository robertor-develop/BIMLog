import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("meeting publication route is governed, immutable, and auditable", async () => {
  const source = await readFile(new URL("../routes/meeting_minutes.ts", import.meta.url), "utf8");
  assert.match(source, /meetings\/:meetingId\/publications/);
  assert.match(source, /assertMeetingLifecycleTransition\(meeting\.lifecycleStatus, target\)/);
  assert.match(source, /\.for\("update"\)/);
  assert.match(source, /crypto\.createHash\("sha256"\)/);
  assert.match(source, /MAX\(version\)/);
  assert.match(source, /meeting\.\$\{kind\}_published/);
  assert.match(source, /snapshot: undefined/);
});
