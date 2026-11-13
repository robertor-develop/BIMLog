import assert from "node:assert/strict";
import { selectLensReportImage } from "./lens-report-image";

const png = "data:image/png;base64,iVBORw0KGgo=";

assert.deepEqual(selectLensReportImage({ ScreenshotDataUrl: png, RedlinesJson: "[{\"type\":\"arrow\"}]" }), {
  kind: "annotated",
  dataUrl: png,
  hasRedlines: true,
  message: "Verified Lens capture with markups.",
});

assert.deepEqual(selectLensReportImage({ screenshotDataUrl: png, redlinesJson: "[]" }), {
  kind: "capture",
  dataUrl: png,
  hasRedlines: false,
  message: "Verified Lens capture; no markups were recorded.",
});

const missingAnnotated = selectLensReportImage({ RedlinesJson: "[{\"type\":\"cloud\"}]" });
assert.equal(missingAnnotated.kind, "unavailable");
assert.equal(missingAnnotated.dataUrl, null);
assert.equal(missingAnnotated.hasRedlines, true);
assert.match(missingAnnotated.message, /unmarked image was not substituted/i);

assert.equal(selectLensReportImage({ ScreenshotDataUrl: "https://example.test/untrusted.png" }).kind, "unavailable");
assert.equal(selectLensReportImage(null).kind, "unavailable");

console.log("Lens report image selection preserves annotated truth and fails closed: PASS");
