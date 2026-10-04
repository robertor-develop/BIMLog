import assert from "node:assert/strict";
import fs from "node:fs";

const schema=fs.readFileSync(new URL("../../../../lib/db/src/schema/commercial-subscriptions.ts",import.meta.url),"utf8");
const migration=fs.readFileSync(new URL("./commercial-subscription-migration.ts",import.meta.url),"utf8");
for(const source of [schema,migration]){
  assert.match(source,/commercial_launch_verifications/);
  assert.match(source,/source_commit/);
  assert.match(source,/evidence_sha256/);
  assert.match(source,/valid_until/);
  assert.match(source,/actor_user_id/);
}
assert.match(schema,/commercial_launch_verifications_digest_uidx/);
assert.match(migration,/commercial_launch_verifications_source_time_idx/);
console.log("B271 durable commercial verification schema: PASS");
