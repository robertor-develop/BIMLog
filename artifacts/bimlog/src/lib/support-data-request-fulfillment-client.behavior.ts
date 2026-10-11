import assert from"node:assert/strict";import{parseDataRequestFulfillmentReceipt}from"./support-data-request-fulfillment-client";
const response={item:{receiptReference:"DSR-2026-000042",summary:"The approved company data export was delivered through the verified support channel.",decisionState:"approved",fulfilledAt:"2026-10-11T18:00:00Z"}};
const parsed=parseDataRequestFulfillmentReceipt(response);assert.equal(parsed.receiptReference,"DSR-2026-000042");assert.equal(parsed.fulfilledAt,"2026-10-11T18:00:00.000Z");assert.equal(Object.isFrozen(parsed),true);
for(const invalid of [{}, {item:null},{item:{...response.item,receiptReference:"x"}},{item:{...response.item,summary:"short"}},{item:{...response.item,decisionState:"denied"}},{item:{...response.item,fulfilledAt:"later"}},{item:{...response.item,fingerprint:"a".repeat(64)}}]){
  if((invalid as any).item?.fingerprint){const safe=parseDataRequestFulfillmentReceipt(invalid);assert.equal("fingerprint" in safe,false);}else assert.throws(()=>parseDataRequestFulfillmentReceipt(invalid));
}
console.log("LR097 strict customer fulfillment receipt contract: PASS");
