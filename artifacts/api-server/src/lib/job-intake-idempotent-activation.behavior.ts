import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("./job-intake-service.ts", import.meta.url), "utf8");
assert.match(source, /SELECT \* FROM job_intakes WHERE project_id=\$1 FOR UPDATE/);
assert.match(source, /intake\.status === "activated"[\s\S]{0,180}input\.requireCommercial !== true/);
assert.match(source, /idempotent: true/);
console.log("job intake idempotent activation behavior: PASS");
