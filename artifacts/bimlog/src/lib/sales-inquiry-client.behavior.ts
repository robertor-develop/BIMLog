import assert from "node:assert/strict";
import {parseSalesInquiryList} from "./sales-inquiry-client";
const row={id:1,fullName:"Ruben Crespo",email:"ruben@example.com",companyName:"BIMTech",country:"Bolivia",interest:"Professional plan",message:"Need a demo",plan:"professional",billingCycle:"annual",useCase:"coordination",status:"new",createdAt:"2026-10-02T12:00:00.000Z",updatedAt:"2026-10-02T12:00:00.000Z"};
assert.equal(parseSalesInquiryList({items:[row],limit:50}).items[0]?.status,"new");
assert.throws(()=>parseSalesInquiryList({items:[row,{...row}],limit:50}),/Duplicate/);
assert.throws(()=>parseSalesInquiryList({items:[{...row,status:"deleted"}],limit:50}),/status/);
assert.throws(()=>parseSalesInquiryList({items:[row],limit:500}),/limit/);
console.log("B101 strict sales inquiry browser contract: PASS");
