import assert from "node:assert/strict";
import {parseSalesInquiryInput,salesInquiryFingerprint} from "./commercial-sales-inquiry";

const raw={fullName:"  Ana   Pérez  ",email:"ANA@Example.COM",companyName:" BIM Tech ",country:"Bolivia",interest:"Team plan",message:"Coordinate seven floors",plan:"team",billingCycle:"annual",useCase:" Shop drawings ",requestKey:"request_1234567890"};
const parsed=parseSalesInquiryInput(raw);
assert.deepEqual({name:parsed.fullName,email:parsed.email,company:parsed.companyName,plan:parsed.plan,cycle:parsed.billingCycle,useCase:parsed.useCase},{name:"Ana Pérez",email:"ana@example.com",company:"BIM Tech",plan:"team",cycle:"annual",useCase:"Shop drawings"});
assert.equal(salesInquiryFingerprint(parsed),salesInquiryFingerprint(parseSalesInquiryInput({...raw,fullName:"Another contact"})));
assert.throws(()=>parseSalesInquiryInput({...raw,plan:"unlimited"}),/Plan/);
assert.throws(()=>parseSalesInquiryInput({...raw,message:"password=secret-value"}),/Credentials/);
assert.throws(()=>parseSalesInquiryInput({...raw,requestKey:"short"}),/identity/);
console.log("B096 canonical bounded sales inquiry contract: PASS");
