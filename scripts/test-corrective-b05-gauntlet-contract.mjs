import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync("scripts/run-corrective-b05-gauntlet.mjs","utf8");
for(const token of ["frontend typecheck","api typecheck","runtime import and retired-module closure","route/index reconciliation","frontend production build","api production build","production artifact closure","database-preview-migration-rollback","authenticated-rendered-desktop-tablet-390","deployment-exact-head"]) assert.ok(source.includes(token),token);
assert.ok(source.includes('result:"UNTESTED"'));
assert.ok(source.includes('"LOCAL_PASS_RELEASE_HOLD"'));
console.log("CORRECTIVE-B05 gauntlet contract PASS: local proof cannot promote untested database/browser/provider/deployment gates");
