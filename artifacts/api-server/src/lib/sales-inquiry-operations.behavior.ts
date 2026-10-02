import assert from "node:assert/strict";
import {assertSalesInquiryTransition} from "./sales-inquiry-operations";
for(const [from,to] of [["new","acknowledged"],["new","qualified"],["new","closed"],["acknowledged","qualified"],["acknowledged","closed"],["qualified","closed"]])assert.doesNotThrow(()=>assertSalesInquiryTransition(from,to));
for(const [from,to] of [["closed","new"],["qualified","acknowledged"],["new","new"],["unknown","closed"]])assert.throws(()=>assertSalesInquiryTransition(from,to));
console.log("B100 governed sales inquiry operations lifecycle: PASS");
