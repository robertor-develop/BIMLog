import assert from "node:assert/strict";import {canChangeSupportCaseAssignment,parseSupportCaseAssignment} from "./support-case-assignment";
assert.deepEqual(parseSupportCaseAssignment({expectedUpdatedAt:"2026-10-02T12:00:00.000Z",assigned:true}),{expectedUpdatedAt:new Date("2026-10-02T12:00:00.000Z"),assigned:true});
for(const value of [{assigned:true},{assigned:"yes",expectedUpdatedAt:"2026-10-02T12:00:00.000Z"},{assigned:false,expectedUpdatedAt:"bad"}])assert.throws(()=>parseSupportCaseAssignment(value));
assert.equal(canChangeSupportCaseAssignment(null,7,true),true);assert.equal(canChangeSupportCaseAssignment(7,7,false),true);assert.equal(canChangeSupportCaseAssignment(8,7,true),false);assert.equal(canChangeSupportCaseAssignment(null,7,false),false);
console.log("B153 revision-safe support self-assignment: PASS");
