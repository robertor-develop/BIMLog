import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
const tsx="artifacts/api-server/node_modules/tsx/dist/cli.mjs";
for(const file of ["artifacts/api-server/src/lib/procore-rfi-import.behavior.ts","artifacts/api-server/src/lib/procore-rfi-import-atomic-store.behavior.ts"])
  execFileSync(process.execPath,[tsx,file],{stdio:"inherit"});
const routes=readFileSync("artifacts/api-server/src/routes/rfis.ts","utf8");
for(const token of ["import/procore/preview","import/procore/commit","PROCORE_RFI_IMPORT_SELECTION_MUST_MATCH_FROZEN_SOURCE","createPostgresProcoreRfiImportStore","requireCurrentProject26ProcoreImportBinding"])
  assert.ok(routes.includes(token),`Procore governed path missing ${token}`);
assert.ok((routes.match(/requirePermission\("admin", "write"\)/g)||[]).length>=2);
console.log("CORRECTIVE-B17 governed Procore RFI preview/commit/binding/idempotency/rollback: PASS");
