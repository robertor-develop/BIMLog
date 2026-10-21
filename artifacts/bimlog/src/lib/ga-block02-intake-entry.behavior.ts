import assert from "node:assert/strict";
import { ANALYZE_INTAKE_ENTRY_POINTS, analyzeIntakeHref } from "./analyze-intake-entry-points";

assert.deepEqual(ANALYZE_INTAKE_ENTRY_POINTS, ["files","upload","rfi-attachment","submittal-attachment","transmittal-attachment","email-connector","document-connector","crawler-review"]);
assert.equal(analyzeIntakeHref(64, "crawler-review", "pc-7"), "/projects/64/files?mode=analyze&source=crawler-review&sourceId=pc-7#canonical-intake-queue");
console.log("GA Block 2 Build 6 intake entry points: PASS");
