import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exactPaymentSum, paymentDto } from "./ContractPaymentApplicationsPanel";

assert.equal(exactPaymentSum(["0.000001","0.000002","999999999999.999997"]),"1000000000000");
assert.equal(exactPaymentSum(["40.000001","59.999999"]),"100");
assert.throws(()=>exactPaymentSum(["1e2"]),/INVALID_DECIMAL/);
assert.throws(()=>exactPaymentSum(["1.0000001"]),/INVALID_DECIMAL/);
const camel=paymentDto({id:"pay-1",applicationNumber:"PAY-001",paymentVersionId:"version-1",supersedesId:null,version:1,revision:3,status:"submitted",periodStart:"2026-08-01",periodEnd:"2026-08-15",currency:"USD",grossAmount:"50",retainageAmount:"5",netAmount:"45",contentFingerprint:"fingerprint",preparedById:11,reviewedById:12,approvedById:null,submittedAt:"submitted",reviewedAt:"reviewed",approvedAt:null,outcomeReason:null,lines:[{id:"payment-line",contractSovLineId:"governed-sov-fk",currentAmount:"50",sortOrder:0}]});
assert.equal(camel.lines[0].contractSovLineId,"governed-sov-fk");
assert.equal(camel.reviewedById,12);
const source=fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),"ContractPaymentApplicationsPanel.tsx"),"utf8");
assert.doesNotMatch(source,/\.toFixed\(|Number\(line\.currentAmount/);
assert.match(source,/contractSovLineId:String\(line\.contractSovLineId\?\?line\.id\?\?line\.stableLineId\)/);
assert.match(source,/CONTRACT_PAYMENT_SOV_EXCEEDED/);
assert.match(source,/Reload authoritative state/);
for(const proof of ["/revisions","Record independent review","Create corrected successor","confirmationFingerprint","CONTRACT_PAYMENT_DUTIES_CONFLICT","Suspended authority always denies","No settlement, accounting, or money movement","Immutable evidence and history","max-width:390px"]){
  const corpus=source+fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),"../../pages/FinancialContractWorkspace.tsx"),"utf8");
  assert.match(corpus,new RegExp(proof.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"i"));
}
console.log(JSON.stringify({suite:"advanced-contract-payments-ui",status:"passed",checks:13},null,2));
