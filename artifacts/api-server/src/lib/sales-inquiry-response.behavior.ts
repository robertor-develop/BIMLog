import assert from "node:assert/strict";
import {salesInquiryIsOverdue,salesInquiryResponseDueAt} from "./sales-inquiry-response";

assert.equal(salesInquiryResponseDueAt(new Date("2026-10-02T14:00:00Z")).toISOString(),"2026-10-05T14:00:00.000Z");
assert.equal(salesInquiryResponseDueAt(new Date("2026-10-05T14:00:00Z")).toISOString(),"2026-10-06T14:00:00.000Z");
assert.equal(salesInquiryIsOverdue({status:"new",responseDueAt:new Date("2026-10-05T14:00:00Z"),now:new Date("2026-10-05T14:00:01Z")}),true);
assert.equal(salesInquiryIsOverdue({status:"closed",responseDueAt:new Date("2026-10-05T14:00:00Z"),now:new Date("2026-10-06T00:00:00Z")}),false);
assert.throws(()=>salesInquiryResponseDueAt(new Date("invalid")));
console.log("B111 deterministic sales inquiry response target: PASS");
