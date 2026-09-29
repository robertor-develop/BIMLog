import assert from "node:assert/strict";
import { jobIntakeSaveConfidence } from "./job-intake-save-confidence";

const failed = jobIntakeSaveConfidence("error");
assert.equal(failed.canRetry, true);
assert.equal(failed.safelyStoredOnServer, false);
assert.equal(failed.retainsEnteredValues, true);
assert.match(failed.en, /failed/i);
assert.match(failed.en, /retained/i);
assert.equal(jobIntakeSaveConfidence("saved").safelyStoredOnServer, true);
console.log("job intake save confidence behavior: PASS");
