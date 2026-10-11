import assert from "node:assert/strict";import {readFileSync} from "node:fs";
const source=readFileSync(new URL("./support-cases.ts",import.meta.url),"utf8");
for(const token of ["dataRequestState:supportCasesTable.dataRequestState","dataRequestReason:supportCasesTable.dataRequestReason","dataRequestReviewedAt:supportCasesTable.dataRequestReviewedAt","dataRequestFulfilledAt:supportCasesTable.dataRequestFulfilledAt"])assert.ok(source.split(token).length-1>=2,token);
assert.ok(source.includes('dataRequestState:input.dataRequestKind?"requested":null'));
assert.ok(source.includes("dataRequestReviewedByUserId:supportCasesTable.dataRequestReviewedByUserId"));
console.log("LR089 requester and administrator data-request outcome projection: PASS");
