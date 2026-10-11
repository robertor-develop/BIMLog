import assert from "node:assert/strict";
import {parseSupportCases} from "./support-case-client";
const base={id:12,category:"data",dataRequestKind:"export",priority:"normal",subject:"Export company records",status:"open",resolutionSummary:null,resolvedAt:null,unreadCount:0,latestMessageAt:null,createdAt:"2026-10-10T12:00:00Z",updatedAt:"2026-10-10T12:00:00Z"};
assert.equal(parseSupportCases({items:[base]})[0]?.dataRequestKind,"export");
assert.equal(parseSupportCases({items:[{...base,dataRequestKind:null}]})[0]?.dataRequestKind,null);
assert.throws(()=>parseSupportCases({items:[{...base,dataRequestKind:"unknown"}]}));
assert.throws(()=>parseSupportCases({items:[{...base,category:"billing"}]}));
console.log("LR084 strict browser customer data-request projection: PASS");
