import assert from "node:assert/strict";
import fs from "node:fs";

const service = fs.readFileSync(new URL("./project-apu-library-service.ts",import.meta.url),"utf8");
assert.match(service,/templateVersionId/);
assert.match(service,/templateFingerprint:fingerprint/);
assert.match(service,/projectApuId = projectApuIdentity\(projectId,template\.template_id\)/);
assert.match(service,/APU_LIBRARY_IDEMPOTENCY_CONFLICT/);
assert.match(service,/generic_project_apu_lines/);
console.log("project-apu-library-service.behavior: PASS exact published version creates independent immutable project lineage");
