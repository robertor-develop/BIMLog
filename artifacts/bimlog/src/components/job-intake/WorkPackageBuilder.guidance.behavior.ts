import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.join(import.meta.dirname, "WorkPackageBuilder.tsx"), "utf8");

assert.match(source, /Work packages are optional/);
assert.match(source, /create one package per floor only when each floor will be managed separately/);
assert.match(source, /cree un paquete por piso solo cuando cada piso se administrará por separado/);
assert.match(source, /dimensionLabel/);
assert.match(source, /value=\{value\}>\{dimensionLabel\(value\)\}/);
assert.match(source, /Remove work package/);

console.log(JSON.stringify({ status: "PASS", build: 8, checks: ["optional-decomposition", "floor-decision-rule", "bilingual-dimensions", "accessible-remove"] }));
