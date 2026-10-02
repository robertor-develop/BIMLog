import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";

const schema=readFileSync(fileURLToPath(new URL("../../../../lib/db/src/schema/contact-submissions.ts",import.meta.url)),"utf8");
const startup=readFileSync(fileURLToPath(new URL("../app.ts",import.meta.url)),"utf8");
for(const column of ["plan","billing_cycle","use_case","request_key","fingerprint","status","updated_at","response_due_at","assigned_to_user_id","assigned_at"]){
  assert.match(schema,new RegExp(column.replace("_","[_A-Za-z]*"),"i"));
  assert.match(startup,new RegExp(`contact_submissions ADD COLUMN IF NOT EXISTS ${column}`,"i"));
}
assert.match(schema,/contact_submissions_request_key_uidx/);
assert.match(startup,/contact_submissions_request_key_uidx/);
assert.match(startup,/contact_submissions_response_due_idx/);
console.log("B097 durable structured sales inquiry schema and startup migration parity: PASS");
