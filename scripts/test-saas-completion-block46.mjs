import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),".."),tsx=path.join(root,"artifacts/api-server/node_modules/tsx/dist/cli.mjs");
execFileSync(process.execPath,[tsx,path.join(root,"artifacts/api-server/src/lib/commercial-persistence.behavior.ts")],{stdio:"inherit"});
const source=readFileSync(path.join(root,"artifacts/api-server/src/lib/commercial-persistence.ts"),"utf8");
for(const contract of ["bindPersistentCheckoutSession","claimPersistentProviderReceipt","applyPersistentCheckoutCompletion","settlePersistentProviderReceipt"])
  if(!source.includes(`function ${contract}`))throw new Error(`provider lifecycle contract missing ${contract}`);
for(const invariant of ["status='creating'","processing_status='processing'","event_type='checkout.session.completed'","processing_status IN ('received','processing')","ROLLBACK"])
  if(!source.includes(invariant))throw new Error(`provider lifecycle invariant missing ${invariant}`);
if(/card_number|payment_method_data|cvc/i.test(source))throw new Error("provider lifecycle must not store card credentials");
console.log("B230 Block 46 durable provider lifecycle acceptance: PASS");
