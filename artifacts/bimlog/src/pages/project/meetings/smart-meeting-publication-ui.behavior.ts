import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("meetings expose bilingual governed publication controls", async () => {
  const source = await readFile(new URL("../MeetingsTab.tsx", import.meta.url), "utf8");
  assert.match(source, /Publish Agenda.*Publicar Agenda/);
  assert.match(source, /Start Meeting.*Iniciar Reunión/);
  assert.match(source, /Complete Meeting.*Completar Reunión/);
  assert.match(source, /Publish Minutes.*Publicar Acta/);
  assert.match(source, /meeting\.id}\/publications/);
  assert.match(source, /meeting\.id}\/lifecycle/);
  assert.match(source, /disabled=\{publicationSaving === m\.id\}/);
  assert.match(source, /published with immutable evidence/);
  assert.match(source, /publicada con evidencia inmutable/);
});
