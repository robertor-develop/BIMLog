import assert from "node:assert/strict";import{parseSupportCases}from"./support-case-client";
const base={id:12,category:"data",dataRequestKind:"export",dataRequestState:"requested",dataRequestReason:null,dataRequestReviewedAt:null,dataRequestFulfilledAt:null,priority:"normal",subject:"Export company records",status:"open",resolutionSummary:null,resolvedAt:null,unreadCount:0,latestMessageAt:null,createdAt:"2026-10-10T12:00:00Z",updatedAt:"2026-10-10T12:00:00Z"};
assert.equal(parseSupportCases({items:[base]})[0]?.dataRequestState,"requested");
assert.equal(parseSupportCases({items:[{...base,dataRequestState:"approved",dataRequestReason:"Approved after identity review.",dataRequestReviewedAt:"2026-10-11T12:00:00Z"}]})[0]?.dataRequestReason,"Approved after identity review.");
assert.equal(parseSupportCases({items:[{...base,dataRequestState:"fulfilled",dataRequestReason:"Secure delivery completed.",dataRequestReviewedAt:"2026-10-11T12:00:00Z",dataRequestFulfilledAt:"2026-10-11T13:00:00Z"}]})[0]?.dataRequestState,"fulfilled");
assert.throws(()=>parseSupportCases({items:[{...base,dataRequestState:"fulfilled",dataRequestFulfilledAt:null}]}));
assert.throws(()=>parseSupportCases({items:[{...base,category:"technical",dataRequestKind:null,dataRequestState:"requested"}]}));
console.log("LR096 strict customer data-request lifecycle projection: PASS");
