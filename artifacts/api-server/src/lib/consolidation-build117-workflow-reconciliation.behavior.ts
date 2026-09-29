import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const runtime = read("artifacts/api-server/src/lib/delivery-workflow-runtime.http-evidence.ts");
const economics = read("artifacts/api-server/src/lib/delivery-workflow-economic-allocation.behavior.ts");
const defaults = read("artifacts/api-server/src/lib/delivery-workflow-defaults.ts");

assert.match(defaults, /SHOP_DRAWING/);
assert.match(defaults, /SLEEVE/);
assert.match(runtime, /Shop checkpoint cannot mutate Sleeve/);
assert.match(runtime, /QC approval/);
assert.match(runtime, /Required DRAWING evidence/);
assert.match(economics, /ALLOCATION_DEDUCTION_MISMATCH/);
assert.match(economics, /ALLOCATION_DUPLICATE_PHASE/);

console.log("consolidation C117 workflow, QC and economics reconciliation: PASS");
