import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
const run=file=>{const r=spawnSync(process.execPath,["artifacts/api-server/node_modules/tsx/dist/cli.mjs",file],{encoding:"utf8"});assert.equal(r.status,0,`${file} failed:\n${r.stdout}\n${r.stderr}`);};
for(const file of ["artifacts/api-server/src/lib/block18-build089-connector-matrix.behavior.ts","artifacts/api-server/src/lib/block18-build090-integration-recovery.behavior.ts","artifacts/bimlog/src/features/lens-next/lens-next-build27-xml-integration.behavior.ts"]) run(file);
console.log("GA-F04-B030 BOUNDED PASS: connector state/replay/recovery behavior; live provider lifecycle UNTESTED");
