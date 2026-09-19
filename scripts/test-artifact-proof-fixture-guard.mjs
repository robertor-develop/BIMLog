import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./prepare-artifact-proof-fixture.mjs", import.meta.url), "utf8");
assert.match(source, /identity\.pathname !== "\/bimlog_rfi_test"/);
assert.match(source, /F:\\\\BIMLog\\\\TestProof/);
assert.match(source, /BIMLOG_ALLOW_DISPOSABLE_FIXTURE_RECREATE !== "YES"/);
assert.match(source, /DROP DATABASE bimlog_rfi_test/);
assert.doesNotMatch(source, /DROP DATABASE\s+\$|DROP DATABASE\s+"\s*\+/);
console.log("ARTIFACT_FIXTURE_GUARD_TESTS=PASS exact_database=1 loopback=1 f_root=1 explicit_recreate=1");
