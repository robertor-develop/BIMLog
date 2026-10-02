import assert from "node:assert/strict";
import {parseSalesInquiryAssignment} from "./sales-inquiry-assignment";
assert.deepEqual(parseSalesInquiryAssignment({expectedUpdatedAt:"2026-10-02T12:00:00.000Z",assigned:true}),{expectedUpdatedAt:new Date("2026-10-02T12:00:00.000Z"),assigned:true});
for(const value of [{assigned:true},{assigned:"yes",expectedUpdatedAt:"2026-10-02T12:00:00.000Z"},{assigned:false,expectedUpdatedAt:"yesterday"}])assert.throws(()=>parseSalesInquiryAssignment(value));
console.log("B113 revision-safe sales inquiry self-assignment: PASS");
