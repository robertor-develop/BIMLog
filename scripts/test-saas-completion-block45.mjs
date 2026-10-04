import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const tsx=path.join(root,"artifacts/api-server/node_modules/tsx/dist/cli.mjs");
execFileSync(process.execPath,[tsx,path.join(root,"artifacts/api-server/src/lib/commercial-persistence.behavior.ts")],{stdio:"inherit"});

const source=readFileSync(path.join(root,"artifacts/api-server/src/lib/commercial-persistence.ts"),"utf8");
for(const contract of ["readPersistentCommercialAuthority","createPersistentOrderCheckout","persistVerifiedProviderReceipt","persistPaidInvoiceWithAudit"])
  if(!source.includes(`function ${contract}`))throw new Error(`commercial persistence contract missing ${contract}`);
for(const invariant of ["FOR UPDATE","provider_event_reference","request_fingerprint","commercial_audit_events","processing_status='applied'","ROLLBACK"])
  if(!source.includes(invariant))throw new Error(`commercial persistence invariant missing ${invariant}`);
if(/api[_-]?key|client[_-]?secret|card_number|payment_method_data/i.test(source))throw new Error("commercial persistence must not store payment credentials");
console.log("B225 Block 45 durable commercial persistence bridge: PASS");
