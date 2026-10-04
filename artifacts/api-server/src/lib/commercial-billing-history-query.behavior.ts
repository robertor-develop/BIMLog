import assert from "node:assert/strict";
import {parseBillingHistoryQuery} from "./commercial-billing-history-query";

assert.deepEqual(parseBillingHistoryQuery({}),{status:"all",page:1,pageSize:10,offset:0});
assert.deepEqual(parseBillingHistoryQuery({status:"paid",page:"3",pageSize:"25"}),{status:"paid",page:3,pageSize:25,offset:50});
for(const input of [{status:"refunded"},{page:"0"},{page:"1.5"},{pageSize:"4"},{pageSize:"51"},{status:["paid","open"]}])assert.throws(()=>parseBillingHistoryQuery(input));
console.log("B246 bounded billing-history query: PASS");
