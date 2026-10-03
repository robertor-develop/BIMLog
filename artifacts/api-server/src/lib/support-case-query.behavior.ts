import assert from "node:assert/strict";import {parseSupportCaseListQuery} from "./support-case-query";
assert.deepEqual(parseSupportCaseListQuery({}),{search:"",workload:"",assignment:"",overdue:false,limit:25,offset:0});
assert.deepEqual(parseSupportCaseListQuery({search:"  Lens  ",workload:"urgent",assignment:"mine",overdue:"true",limit:"50",offset:"25"}),{search:"Lens",workload:"urgent",assignment:"mine",overdue:true,limit:50,offset:25});
for(const query of [{search:"x".repeat(121)},{workload:"all"},{assignment:"other"},{overdue:"yes"},{limit:0},{limit:101},{offset:-1}])assert.throws(()=>parseSupportCaseListQuery(query));
console.log("B157 bounded support queue query contract: PASS");
