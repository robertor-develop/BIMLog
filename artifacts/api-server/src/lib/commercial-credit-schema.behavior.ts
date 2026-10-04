import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../../..");
const source=readFileSync(path.join(root,"lib/db/src/schema/commercial-subscriptions.ts"),"utf8");
for(const token of ["commercialCreditNotesTable","commercial_credit_notes","credit_number","invoice_id","provider_event_reference","amount_cents","approved_by_user_id","commercial_credit_notes_provider_event_uidx"])
  assert.ok(source.includes(token),`missing credit/refund authority ${token}`);
assert.match(source,/amountCents}>0/);
assert.match(source,/char_length\(\$\{table\.reason\}\) between 3 and 500/);
console.log("B217 durable approved credit and refund authority: PASS");
