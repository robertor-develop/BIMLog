import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("./JobOperationsWorkspace.tsx",import.meta.url),"utf8");
assert.match(source,/different active company financial administrator or global Super Administrator/);
assert.match(source,/canApprove/);
assert.match(source,/You already have the configured cost-approval authority/);
assert.match(source,/The label does not grant access/);
assert.doesNotMatch(source,/blocked until CEO approval/);
console.log("Job Operations governance guidance: PASS");
