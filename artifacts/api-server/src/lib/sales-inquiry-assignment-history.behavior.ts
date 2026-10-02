import assert from "node:assert/strict";
import {parseSalesInquiryAssignmentHistoryQuery} from "./sales-inquiry-assignment-history";
assert.deepEqual(parseSalesInquiryAssignmentHistoryQuery({}),{limit:25,offset:0});
assert.deepEqual(parseSalesInquiryAssignmentHistoryQuery({limit:"100",offset:"50"}),{limit:100,offset:50});
for(const query of [{limit:"0"},{limit:"101"},{offset:"-1"},{limit:["25"]},{offset:"1.5"}])assert.throws(()=>parseSalesInquiryAssignmentHistoryQuery(query),/INVALID/);
console.log("B121 bounded sales inquiry assignment history query: PASS");
