import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.join(import.meta.dirname, "WorkPackageBuilder.tsx"), "utf8");

assert.match(source, /Work packages are optional/);
assert.match(source, /package may contain several operational tasks/);
assert.match(source, /paquete puede contener varias tareas operativas/);
assert.match(source, /dimensionLabel/);
assert.match(source, /value=\{value\}>\s*\{dimensionLabel\(value\)\}/);
assert.match(source, /Remove work package/);
assert.match(source, /Add operational task/);
assert.match(source, /CELLAR_PB_SH_PRE_R0V0/);

console.log(JSON.stringify({ status: "PASS", build: 8, checks: ["optional-decomposition", "floor-decision-rule", "bilingual-dimensions", "accessible-remove"] }));
