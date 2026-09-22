import assert from "node:assert/strict";
import fs from "node:fs";

const schema = fs.readFileSync(new URL("../../../../lib/db/src/schema/job-intakes.ts", import.meta.url), "utf8");
const economic = fs.readFileSync(new URL("./edt-engine-economic-service.ts", import.meta.url), "utf8");
const changes = fs.readFileSync(new URL("./edt-engine-governed-change-service.ts", import.meta.url), "utf8");

const workItemDefinition = schema.split("export const jobActivationWorkItemsTable =")[1]?.split("export const jobActivationEdtNodesTable =")[0];
assert.ok(workItemDefinition, "Work Item schema must be present");
assert.doesNotMatch(workItemDefinition, /companyId:\s*integer\("company_id"\)/);
for (const [name, source] of [["economic", economic], ["governed change", changes]] as const) {
  assert.doesNotMatch(source, /\bw\.company_id\b|\bFROM job_activation_work_items WHERE[^"\n]*company_id/,
    `${name} cannot query a company column absent from Work Items`);
  assert.match(source, /JOIN job_intakes i ON i\.id=w\.intake_id AND i\.project_id=w\.project_id/,
    `${name} must derive the company from the canonical Intake`);
  assert.match(source, /i\.company_id=\$3/);
}
console.log("EDT_ENGINE_BUILD306_RESULT=PASS Work Item tenant queries use canonical Intake scope");
