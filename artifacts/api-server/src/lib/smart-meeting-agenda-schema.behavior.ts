import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("agenda items preserve canonical sources and coordinator exclusions", async () => {
  const schema = await readFile(new URL("../../../../lib/db/src/schema/meeting-minutes.ts", import.meta.url), "utf8");
  assert.match(schema, /meetingAgendaItemsTable = pgTable\(/);
  assert.match(schema, /sourceKind: text\("source_kind"\)/);
  assert.match(schema, /excludedFromNext: boolean\("excluded_from_next"\)/);
  assert.match(schema, /meeting_agenda_items_source_uidx/);
});

test("agenda migration is additive and retry safe", async () => {
  const app = await readFile(new URL("../app.ts", import.meta.url), "utf8");
  assert.match(app, /CREATE TABLE IF NOT EXISTS meeting_agenda_items/);
  assert.match(app, /CREATE UNIQUE INDEX IF NOT EXISTS meeting_agenda_items_source_uidx/);
  assert.match(app, /WHERE source_id IS NOT NULL/);
});
