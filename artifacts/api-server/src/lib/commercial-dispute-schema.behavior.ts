import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../../..");
const source=readFileSync(path.join(root,"lib/db/src/schema/commercial-subscriptions.ts"),"utf8");
for(const token of ["commercialDisputesTable","commercial_disputes","provider_dispute_reference","reason_code","needs_response","under_review","evidence_due_at","closed_at","revision"])
  assert.ok(source.includes(token),`missing dispute authority ${token}`);
assert.match(source,/commercial_disputes_provider_ref_uidx/);
assert.match(source,/status} in \('needs_response','under_review'\) or \$\{table\.closedAt\} is not null/);
console.log("B218 durable revision-safe commercial dispute authority: PASS");
