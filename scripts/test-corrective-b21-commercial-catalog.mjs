import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const tsx="artifacts/api-server/node_modules/tsx/dist/cli.mjs";
execFileSync(process.execPath,[tsx,"artifacts/api-server/src/lib/commercial-platform-readiness.behavior.ts"],{stdio:"inherit"});
const source=readFileSync("artifacts/api-server/src/lib/commercial-platform-readiness.ts","utf8");
for(const slot of ["professional","team","business"]) assert.ok(source.includes(slot),`missing paid offer ${slot}`);
for(const cycle of ["monthly","annual"]) assert.ok(source.includes(cycle),`missing billing cycle ${cycle}`);
assert.match(source,/const duplicatePrices=new Set\(prices\.filter/);
assert.match(source,/entries\.length===requiredSlots\.length&&mapped\.size===requiredSlots\.length&&catalogCoverage\.every/);
assert.match(source,/catalog_invalid/);
console.log("CORRECTIVE-B21 six-slot Stripe catalog validation and uniqueness: PASS; live price ownership: REQUIRES CONFIGURATION");
