import assert from "node:assert/strict";
import fs from "node:fs";

const ui = fs.readFileSync(new URL("../../../bimlog/src/pages/JobIntakeWorkspace.tsx", import.meta.url), "utf8");
const service = fs.readFileSync(new URL("./job-intake-service.ts", import.meta.url), "utf8");
assert.match(ui, /await persist\(dataRef\.current\)/);
assert.match(ui, /\/intake\/activate/);
assert.match(ui, /confirmationFingerprint/);
assert.match(ui, /Save and complete every required Intake item before activation/);
assert.match(service, /confirmationFingerprint/);
assert.match(service, /status: "activated"/);
assert.match(service, /expectedRevision/);
console.log("POST-P17 Build 09 governed Intake activation contract: PASS");
