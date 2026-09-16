import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const harness = readFileSync(new URL("../../lens-next-acceptance-harness.tsx", import.meta.url), "utf8");
const harnessHtml = readFileSync(new URL("../../../lens-next-acceptance-harness.html", import.meta.url), "utf8");
const productionHtml = readFileSync(new URL("../../../index.html", import.meta.url), "utf8");

assert.match(harness, /import \{ LensNextPanelView/);
assert.match(harness, /<LensNextPanelView \{\.\.\.props\}/);
assert.match(harness, /LENS_NEXT_ACCEPTANCE_FIXTURES/);
assert.match(harness, /Array\.from\(\{ length: 100 \}/);
assert.match(harnessHtml, /lens-next-acceptance-harness\.tsx/);
assert.doesNotMatch(productionHtml, /lens-next-acceptance-harness/);
assert.doesNotMatch(harness, /fetch\(|\/api\/|localStorage\.setItem/);

console.log("BUILD31_ACCEPTANCE_HARNESS=PASS production_component=true fixtures=100 production_route=false");
