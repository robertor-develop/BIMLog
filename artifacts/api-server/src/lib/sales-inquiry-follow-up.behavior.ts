import assert from "node:assert/strict";import {parseSalesInquiryFollowUp} from "./sales-inquiry-follow-up";
assert.deepEqual(parseSalesInquiryFollowUp({note:"  Demo scheduled  ",expectedUpdatedAt:"2026-10-02T12:00:00.000Z"}),{note:"Demo scheduled",expectedUpdatedAt:new Date("2026-10-02T12:00:00.000Z")});
for(const value of [{note:"",expectedUpdatedAt:"2026-10-02T12:00:00.000Z"},{note:"x",expectedUpdatedAt:"bad"},{note:"x".repeat(4001),expectedUpdatedAt:"2026-10-02T12:00:00.000Z"}])assert.throws(()=>parseSalesInquiryFollowUp(value),/INVALID/);
console.log("B126 bounded sales inquiry follow-up contract: PASS");
