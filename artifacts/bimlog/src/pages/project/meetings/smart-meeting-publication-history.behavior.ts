import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("meeting publication history is visible, bilingual, and fingerprinted", async () => {
  const source = await readFile(new URL("../MeetingsTab.tsx", import.meta.url), "utf8");
  assert.match(source, /View publication history.*Ver historial de publicación/);
  assert.match(source, /Immutable publication history.*Historial inmutable de publicaciones/);
  assert.match(source, /snapshotSha256\.slice\(0, 12\)/);
  assert.match(source, /publication\.publishedAt/);
  assert.match(source, /No agenda or minutes have been published yet/);
  assert.match(source, /role="alert"/);
});
