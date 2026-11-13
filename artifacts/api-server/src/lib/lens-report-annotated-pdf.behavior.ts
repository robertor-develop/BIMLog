import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../routes/clash_reports.ts", import.meta.url), "utf8");

assert.match(route, /validatePersistedLensNextVisualState\([\s\S]*reportImageEvidence\.set/);
assert.match(route, /imageEvidence:\s*\{[\s\S]*visualStateDigest:/);
assert.match(route, /doc\.image\(imageBytes,[\s\S]*fit:\s*\[CW, imageHeight\]/);
assert.match(route, /ANNOTATED CAPTURE/);
assert.match(route, /CAPTURE — NO MARKUPS RECORDED/);
assert.match(route, /Verified Lens capture unavailable; the stored visual package did not pass integrity validation/);
assert.doesNotMatch(route, /reportImageEvidence[\s\S]{0,500}screenshotUrl/);

console.log("Lens PDF embeds digest-bound verified captures and refuses unmarked fallback: PASS");
