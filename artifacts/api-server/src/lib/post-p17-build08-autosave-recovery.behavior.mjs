import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../../../bimlog/src/pages/JobIntakeWorkspace.tsx", import.meta.url), "utf8");
assert.match(source, /bimlog:job-intake-recovery:/);
assert.match(source, /preserveRecovery\(projectId, revisionRef\.current, data\)/);
assert.match(source, /setSaveState\("error"\)/);
assert.match(source, /saveRetryRef\.current < 2/);
assert.match(source, /2000/);
assert.match(source, /Recovered unsaved Contract Items from this browser\. Autosave is retrying now\./);
assert.match(source, /beforeunload/);
console.log("POST-P17 Build 08 autosave/retry/recovery contract: PASS");
