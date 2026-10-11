import assert from "node:assert/strict";import {dataRequestFulfillmentFingerprint,parseDataRequestFulfillment} from "./commercial-data-request-fulfillment";
const base={kind:"export",expectedState:"approved",expectedUpdatedAt:"2026-10-11T12:00:00.000Z",receiptReference:"DR-91-EXPORT",summary:"Secure export was delivered through the governed channel."};
const parsed=parseDataRequestFulfillment(base);assert.equal(parsed.kind,"export");assert.equal(parsed.expectedState,"approved");assert.equal(parsed.receiptReference,"DR-91-EXPORT");assert.equal(dataRequestFulfillmentFingerprint(parsed).length,64);
assert.equal(parseDataRequestFulfillment({...base,kind:"restriction",expectedState:"partially_approved"}).kind,"restriction");
for(const invalid of [{...base,kind:"other"},{...base,expectedState:"under_review"},{...base,receiptReference:"https://example.com"},{...base,summary:"token=secret value"},{...base,summary:"short"},{...base,expectedUpdatedAt:"bad"}])assert.throws(()=>parseDataRequestFulfillment(invalid));
console.log("LR091 governed data-request fulfillment contract: PASS");
