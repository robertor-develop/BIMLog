import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("attendee import is visible, bilingual and confirmation-gated", async () => {
  const component = await readFile(new URL("../../../bimlog/src/pages/project/meetings/MeetingAttendeePasteReview.tsx", import.meta.url), "utf8");
  const tab = await readFile(new URL("../../../bimlog/src/pages/project/MeetingsTab.tsx", import.meta.url), "utf8");
  assert.match(tab, /MeetingAttendeePasteReview/);
  assert.match(component, /Import attendee list/);
  assert.match(component, /Importar lista de asistentes/);
  assert.match(component, /Nothing is added until you review and confirm/);
  assert.match(component, /Confirm attendees/);
  assert.match(component, /disabled=!reviewing|disabled=\{!reviewing/);
  assert.match(component, /Correct invalid email addresses/);
  assert.match(component, /Remove duplicate email addresses/);
});
