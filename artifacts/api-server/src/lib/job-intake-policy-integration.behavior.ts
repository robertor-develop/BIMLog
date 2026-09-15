import assert from "node:assert/strict";
import fs from "node:fs";
const service = fs.readFileSync(new URL("./job-intake-service.ts", import.meta.url), "utf8");
assert.match(service, /featureKey: "project\.intake\.configuration"/);
assert.match(service, /companyId: access\.companyId, projectId: access\.projectId/);
assert.match(service, /resolved\.decision === "allow"/);
assert.match(service, /source: policy\.configured \? "governed_policy" : "bimlog_default"/);
assert.match(service, /applyIntakePolicyDefaults/);
console.log("job-intake-policy-integration: PASS");
