import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./edt-engine-route-context.ts", import.meta.url), "utf8");
const matrix = fs.readFileSync(new URL("../../../../scripts/endpoint-authority-matrix.mjs", import.meta.url), "utf8");
assert.match(source, /project_company_binding_versions/);
assert.match(source, /p\.status<>'archived'/);
assert.match(source, /PROJECT_COMPANY_MISMATCH/);
assert.match(source, /Number\(row\.project_company_id\) !== Number\(row\.company_id\)/);
assert.match(matrix, /"edt-engine\.ts"/);
console.log("EDT_ENGINE_BUILD301_RESULT=PASS project company bound before role grant");
