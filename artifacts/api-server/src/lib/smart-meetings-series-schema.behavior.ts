import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const schemaUrl = new URL(
  "../../../../lib/db/src/schema/meeting-minutes.ts",
  import.meta.url,
);
const appUrl = new URL("../app.ts", import.meta.url);

test("smart meeting series schema is additive and project scoped", async () => {
  const schema = await readFile(schemaUrl, "utf8");
  assert.match(schema, /meetingSeriesTable = pgTable\(\s*"meeting_series"/);
  assert.match(schema, /projectId: integer\("project_id"\)/);
  assert.match(schema, /agendaPolicy: jsonb\("agenda_policy"\)/);
  assert.match(schema, /lifecycleStatus: text\("lifecycle_status"\)/);
  assert.match(schema, /sourceEventId: text\("source_event_id"\)/);
});

test("startup migration is retry-safe and protects provider event identity", async () => {
  const app = await readFile(appUrl, "utf8");
  assert.match(app, /CREATE TABLE IF NOT EXISTS meeting_series/);
  assert.match(app, /ADD COLUMN IF NOT EXISTS series_id/);
  assert.match(app, /meeting_minutes_provider_event_uidx/);
  assert.match(app, /WHERE source_provider IS NOT NULL AND source_event_id IS NOT NULL/);
});
