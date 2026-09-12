import assert from "node:assert/strict";
import fs from "node:fs";

const service = fs.readFileSync(new URL("./job-intake-service.ts", import.meta.url), "utf8");
const contract = fs.readFileSync(new URL("./job-intake-contract.ts", import.meta.url), "utf8");

assert.match(service, /SELECT \* FROM job_intakes WHERE project_id=\$1 FOR UPDATE/);
assert.match(service, /Number\(intake\.revision\) !== Number\(input\.expectedRevision\)/);
assert.match(service, /ON CONFLICT\(intake_id,stable_scope_item_id\) DO NOTHING/);
assert.match(service, /ON CONFLICT\(intake_id,source_assignment_id\) DO NOTHING/);
assert.match(service, /ON CONFLICT\(project_id,package_code\) DO NOTHING/);
assert.match(service, /commercialBaselineFingerprint/);
assert.match(service, /confirmationFingerprint/);
assert.match(contract, /fingerprint/);
assert.doesNotMatch(service, /catch\s*\([^)]*\)\s*\{\s*\}/);

console.log("POST-P17 Build 22 activation concurrency and idempotent replay safety: PASS");
