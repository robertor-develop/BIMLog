import assert from "node:assert/strict";
import { parseSalesInquiryListQuery } from "./sales-inquiry-query";

assert.deepEqual(parseSalesInquiryListQuery({}), { status: "", search: "", overdue:false, limit: 25, offset: 0 });
assert.deepEqual(parseSalesInquiryListQuery({ status: "qualified", search: "  BIM Tech  ", overdue:"true", limit: "50", offset: "100" }), { status: "qualified", search: "BIM Tech", overdue:true, limit: 50, offset: 100 });
for (const query of [{ status: "deleted" }, { search: "x".repeat(121) }, {overdue:"yes"}, { limit: 0 }, { limit: 101 }, { limit: "2.5" }, { offset: -1 }, { offset: "no" }]) assert.throws(() => parseSalesInquiryListQuery(query));
console.log("B106 bounded sales inquiry search and pagination query: PASS");
