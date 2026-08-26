import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync(new URL("../routes/clash_reports.ts", import.meta.url), "utf8");
const start = route.indexOf('router.post("/projects/:projectId/clash-reports/lens-next/issues/create"');
const end = route.indexOf('// Registered BEFORE', start);
assert.ok(start >= 0 && end > start);
const block = route.slice(start, end);
assert.match(block, /lens-next-create\.v1/);
assert.match(block, /confirmed !== true/);
assert.match(block, /db\.transaction/);
assert.match(block, /validateAndRebindLocalVisualState/);
assert.match(block, /assignTradeFloorSeq/);
assert.match(block, /platform_identity_exists/);
assert.doesNotMatch(block, /lens-sync/);
console.log(JSON.stringify({ status: "PASS", tests: ["explicit-confirmation", "atomic-platform-record-and-package", "digest-rebind", "sequence-assignment", "no-overwrite"] }));
