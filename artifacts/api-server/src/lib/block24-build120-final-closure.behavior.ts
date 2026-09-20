import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "../..");
const evidenceRoot = path.join(root, "evidence/stabilization-program-20260919");
for (let build = 116; build <= 120; build += 1) {
  assert.ok(fs.readdirSync(evidenceRoot).some((name) => name.startsWith(`BUILD_${build}_`)), `missing Build ${build} evidence`);
}
const closure = fs.readFileSync(path.join(evidenceRoot, "BUILD_120_FINAL_CLOSURE.md"), "utf8");
assert.match(closure, /exact source/i);
assert.match(closure, /Status: `NOT_STARTED`/);
assert.match(closure, /visible Chrome/i);
assert.match(closure, /Replit Agents.*prohibited/i);
assert.match(closure, /installer contract.*Original\/Legacy Lens.*Pulse/i);
assert.match(closure, /do not silently waive.*connected 2025 field requirement/i);
console.log("block24 build120 final closure contract: PASS");
