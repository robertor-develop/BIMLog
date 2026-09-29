import assert from "node:assert/strict";
import { needsCompactNavigation, responsivePresentation, supportedViewportWidths } from "./responsive-layout";

assert.deepEqual(supportedViewportWidths, [320, 390, 768, 1280]);
assert.equal(responsivePresentation(320).table, "cards");
assert.equal(responsivePresentation(390).actions, "stacked");
assert.equal(responsivePresentation(768).navigation, "drawer");
assert.equal(responsivePresentation(1280).navigation, "sidebar");
assert.equal(needsCompactNavigation(1280, 2), true);
assert.equal(needsCompactNavigation(1280, 1), false);
console.log("post120 Build 188 responsive shell patterns: PASS");
