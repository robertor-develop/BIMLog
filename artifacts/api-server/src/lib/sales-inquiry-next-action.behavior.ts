import assert from "node:assert/strict";
import {parseSalesInquiryNextAction} from "./sales-inquiry-next-action";
const now=new Date("2026-10-02T12:00:00.000Z");
assert.deepEqual(parseSalesInquiryNextAction({type:"demo",dueAt:"2026-10-03T12:00:00.000Z",expectedUpdatedAt:"2026-10-02T11:00:00.000Z"},now),{type:"demo",dueAt:new Date("2026-10-03T12:00:00.000Z"),expectedUpdatedAt:new Date("2026-10-02T11:00:00.000Z")});
for(const value of [{type:"meeting",dueAt:"2026-10-03T12:00:00.000Z",expectedUpdatedAt:"2026-10-02T11:00:00.000Z"},{type:"call",dueAt:"bad",expectedUpdatedAt:"2026-10-02T11:00:00.000Z"},{type:"call",dueAt:"2026-09-01T12:00:00.000Z",expectedUpdatedAt:"2026-10-02T11:00:00.000Z"}])assert.throws(()=>parseSalesInquiryNextAction(value,now),/INVALID/);
console.log("B131 bounded sales inquiry next-action contract: PASS");
