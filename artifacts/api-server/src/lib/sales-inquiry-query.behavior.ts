import assert from "node:assert/strict";
import { parseSalesInquiryListQuery } from "./sales-inquiry-query";

assert.deepEqual(parseSalesInquiryListQuery({}), { status: "", search: "", overdue:false, assignment:"", limit: 25, offset: 0 });
assert.deepEqual(parseSalesInquiryListQuery({ status: "qualified", search: "  BIM Tech  ", overdue:"true", assignment:"mine", limit: "50", offset: "100" }), { status: "qualified", search: "BIM Tech", overdue:true, assignment:"mine", limit: 50, offset: 100 });
assert.equal(parseSalesInquiryListQuery({assignment:"unassigned"}).assignment,"unassigned");
for (const query of [{ status: "deleted" }, { search: "x".repeat(121) }, {overdue:"yes"}, {assignment:"anybody"}, { limit: 0 }, { limit: 101 }, { limit: "2.5" }, { offset: -1 }, { offset: "no" }]) assert.throws(() => parseSalesInquiryListQuery(query));
console.log("B117 bounded sales inquiry ownership scopes: PASS");
