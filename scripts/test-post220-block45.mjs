import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const read = relative => fs.readFileSync(relative, "utf8");
const json = relative => JSON.parse(read(relative));
const open = json("living-brief/OPEN_LOOP_DISPOSITIONS.json");
const field = json("evidence/stabilization-program-20260919/LENS_NEXT_FIELD_EVIDENCE.json");
const current = open.items.filter(item => item.currentAuthority && item.classification === "ACTIVE");
const currentField = current.filter(item => item.workClass === "FIELD_EVIDENCE");
const currentProvider = current.filter(item => item.workClass === "PROVIDER_EVIDENCE");

assert.equal(currentField.length, 1);
assert.match(currentField[0].statement, /Navisworks 2025/);
assert.match(currentField[0].statement, /Ruben/);
assert.equal(currentProvider.length, 1);
assert.match(currentProvider[0].statement,/Build 265/);
assert.equal(field.installed2021.retiredDirectLoad.state, "REMOVED_WITH_ROLLBACK_EVIDENCE");
assert.equal(field.installed2021.retiredDirectLoad.activeAfterCutover, false);
assert.equal(field.rubenPhysical2025.status, "DEFERRED_TO_RUBEN");
assert.equal(field.rubenPhysical2025.blocksPlatformPublication, false);

for (const script of ["scripts/test-post120-block38.mjs", "scripts/test-post120-block39.mjs", "scripts/test-post120-block44.mjs", "scripts/test-build223-field-evidence-boundary.mjs"]) {
  const result = spawnSync(process.execPath, [script], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

console.log(`POST220_BLOCK45=PASS currentOpen=${current.length} currentProvider=${currentProvider.length} currentField=RUBEN_2025_FIELD_EVIDENCE physical2021=PASS`);
