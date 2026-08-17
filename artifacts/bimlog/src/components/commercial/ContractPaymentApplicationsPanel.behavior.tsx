import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exactPaymentSum } from "./ContractPaymentApplicationsPanel";

assert.equal(exactPaymentSum(["0.000001","0.000002","999999999999.999997"]),"1000000000000");
assert.equal(exactPaymentSum(["40.000001","59.999999"]),"100");
assert.throws(()=>exactPaymentSum(["1e2"]),/INVALID_DECIMAL/);
assert.throws(()=>exactPaymentSum(["1.0000001"]),/INVALID_DECIMAL/);
const source=fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),"ContractPaymentApplicationsPanel.tsx"),"utf8");
assert.doesNotMatch(source,/\.toFixed\(|Number\(line\.currentAmount/);
for(const proof of ["/revisions","Record independent review","Create corrected successor","confirmationFingerprint","CONTRACT_PAYMENT_DUTIES_CONFLICT","Suspended authority always denies","No settlement, accounting, or money movement","Immutable evidence and history","max-width:390px"]){
  const corpus=source+fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),"../../pages/FinancialContractWorkspace.tsx"),"utf8");
  assert.match(corpus,new RegExp(proof.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"i"));
}
console.log(JSON.stringify({suite:"advanced-contract-payments-ui",status:"passed",checks:13},null,2));
