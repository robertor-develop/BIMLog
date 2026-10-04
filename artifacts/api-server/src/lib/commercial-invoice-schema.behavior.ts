import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../../..");
const source=readFileSync(path.join(root,"lib/db/src/schema/commercial-subscriptions.ts"),"utf8");
for(const token of ["commercialInvoicesTable","commercial_invoices","invoice_number","provider_invoice_reference","subtotal_cents","tax_cents","total_cents","issued_at","paid_at","commercial_invoices_checkout_uidx"])
  assert.ok(source.includes(token),`missing invoice authority ${token}`);
assert.match(source,/totalCents\}=\$\{table\.subtotalCents\}\+\$\{table\.taxCents\}/);
assert.match(source,/status}<>'paid' or \$\{table\.paidAt\} is not null/);
console.log("B216 durable integer-cent commercial invoice authority: PASS");
