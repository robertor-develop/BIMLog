import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("meeting list exposes governed bilingual create-next workflow", async () => {
  const ui = await readFile(new URL("../../../bimlog/src/pages/project/MeetingsTab.tsx", import.meta.url), "utf8");
  assert.match(ui, /const createNextMeeting = async \(meeting: Meeting\)/);
  assert.match(ui, /meetings\/\$\{meeting\.id\}\/create-next/);
  assert.match(ui, /Authorization: `Bearer \$\{token\}`/);
  assert.match(ui, /await loadMeetings\(\)/);
  assert.match(ui, /Create Next/);
  assert.match(ui, /Crear Próxima/);
  assert.match(ui, /disabled=\{actionSaving\}/);
});
