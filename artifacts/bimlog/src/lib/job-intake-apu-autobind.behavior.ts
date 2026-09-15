import assert from "node:assert/strict";
import fs from "node:fs";
const ui = fs.readFileSync(new URL("../pages/JobIntakeWorkspace.tsx", import.meta.url), "utf8");
assert.match(ui, /current\.status !== "activated"/);
assert.match(ui, /applySoleApuToUnboundItems\(loadedData\.scopeItems/);
assert.match(ui, /only compatible saved APU version/);
assert.match(ui, /única versión APU guardada compatible/);
assert.doesNotMatch(ui, /applySoleApuToUnboundItems\(current\.data/);
console.log("job-intake-apu-autobind: PASS");
