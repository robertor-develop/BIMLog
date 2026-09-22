import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./edt-engine-qc-import-service.ts", import.meta.url), "utf8");
assert.match(source, /job_intake_documents WHERE intake_id=\$1 AND project_id=\$2 AND file_id=\$3 AND removed_at IS NULL/);
assert.match(source, /source\.source_hash\.toLowerCase\(\)!==input\.fileSha256/);
assert.match(source, /IMPORT_SOURCE_MISMATCH/);
assert.match(source, /preview_fingerprint,status,requested_by_id\) VALUES\([^)]*'previewed'/);
assert.doesNotMatch(source, /invalid\?"invalid":"validated"/);
console.log("EDT_ENGINE_BUILD303_RESULT=PASS import source bound; client preview cannot self-validate");
