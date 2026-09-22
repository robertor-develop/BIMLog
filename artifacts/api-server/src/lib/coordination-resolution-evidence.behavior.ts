import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repository=readFileSync(join(import.meta.dirname,"coordination-knowledge-repository.ts"),"utf8");
const routes=readFileSync(join(import.meta.dirname,"../routes/coordination-knowledge.ts"),"utf8");
const migration=readFileSync(join(import.meta.dirname,"coordination-knowledge-migration.ts"),"utf8");
assert.match(repository,/addResolutionEvidence/);
assert.match(repository,/revision\.id=\$1 AND revision\.company_id=\$2 AND revision\.project_id=\$3/);
assert.match(repository,/file_id/);
assert.match(routes,/resolution\/evidence/);
assert.match(routes,/"before"&&role!=="after"&&role!=="supporting"/);
assert.match(migration,/model_view_reference jsonb/);
console.log("Build 257 resolution evidence: PASS");
