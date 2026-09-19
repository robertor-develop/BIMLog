import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./database-restore-rehearsal.mjs", import.meta.url), "utf8");
const artifactProof = fs.readFileSync(new URL("../artifacts/api-server/scripts/test-production-artifact-closure.ts", import.meta.url), "utf8");
const apiBuild = fs.readFileSync(new URL("../artifacts/api-server/build.ts", import.meta.url), "utf8");
for (const required of [
  '"bimlog_rfi_test"', '"bimlog_rfi_restore_test"', "F:\\\\BIMLOG\\\\TESTPROOF\\\\",
  "pg_dump.exe", "pg_restore.exe", "--format=custom", "sourceRecordCountManifestSha256",
  "restoredRecordCountManifestSha256", "DROP DATABASE bimlog_rfi_restore_test",
]) assert.ok(source.includes(required), `missing restore safeguard: ${required}`);
assert.doesNotMatch(source, /DROP DATABASE\s+\$\{/);
assert.match(artifactProof, /BIMLOG_ALLOW_RESTORED_ARTIFACT_PROOF === "YES"/);
assert.match(artifactProof, /\/bimlog_rfi_restore_test/);
assert.match(apiBuild, /removeGeneratedDirectory/);
assert.match(apiBuild, /"EBUSY", "ENOTEMPTY", "EPERM"/);
assert.match(apiBuild, /attempt <= 10/);
console.log("DATABASE_RESTORE_REHEARSAL_GUARDS=PASS fixed_source=1 fixed_restore=1 f_root=1 hashes=1 bounded_cleanup=1");
