import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("meeting publication schema preserves immutable versioned snapshots", async () => {
  const schema = await readFile(new URL("../../../../lib/db/src/schema/meeting-minutes.ts", import.meta.url), "utf8");
  const app = await readFile(new URL("../app.ts", import.meta.url), "utf8");
  assert.match(schema, /meetingPublicationsTable = pgTable\(\s*"meeting_publications"/);
  assert.match(schema, /meetingPublications_meeting_kind_version_uidx|meeting_publications_meeting_kind_version_uidx/);
  assert.match(schema, /snapshotSha256: text\("snapshot_sha256"\)\.notNull\(\)/);
  assert.match(app, /CREATE TABLE IF NOT EXISTS meeting_publications/);
  assert.match(app, /CHECK \(kind IN \('agenda','minutes'\)\)/);
  assert.match(app, /CHECK \(version > 0\)/);
  assert.doesNotMatch(app, /meeting_publications[\s\S]{0,500}ON DELETE CASCADE/);
});
