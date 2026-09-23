import assert from "node:assert/strict";
import { lensNextDockWidth } from "./lens-next-dock-width.ts";

for (const width of [0, 320, 450]) assert.equal(lensNextDockWidth(width), "narrow");
for (const width of [451, 480, 700, 799]) assert.equal(lensNextDockWidth(width), "medium");
for (const width of [800, 1024, 1600]) assert.equal(lensNextDockWidth(width), "wide");
assert.equal(lensNextDockWidth(Number.NaN), "narrow");
console.log("Lens Next container-width classification: PASS");
