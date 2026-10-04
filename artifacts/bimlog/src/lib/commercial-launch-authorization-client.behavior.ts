import assert from "node:assert/strict";
import {parseCommercialLaunchAuthorization} from "./commercial-launch-client";

const source="a".repeat(40),receipt={id:"receipt",actorUserId:7,sourceCommit:source,status:"verified",verified:true,checkedAt:"2026-10-04T19:00:00.000Z",validUntil:"2026-10-04T19:15:00.000Z",checkCount:1,failedCheckIds:[],checks:[{id:"stripe.account",status:"verified",code:"account_verified"}],evidenceSha256:"b".repeat(64),recordedAt:"2026-10-04T19:00:01.000Z"};
const current=parseCommercialLaunchAuthorization({status:"current",ready:true,sourceCommit:source,receipt,evaluatedAt:"2026-10-04T19:05:00.000Z"});assert.equal(current.receipt?.id,"receipt");
assert.equal(parseCommercialLaunchAuthorization({status:"missing",ready:false,sourceCommit:source,receipt:null,evaluatedAt:"2026-10-04T19:05:00.000Z"}).status,"missing");
assert.throws(()=>parseCommercialLaunchAuthorization({status:"expired",ready:true,sourceCommit:source,receipt,evaluatedAt:"2026-10-04T19:20:00.000Z"}),/invalid/);
assert.throws(()=>parseCommercialLaunchAuthorization({status:"current",ready:true,sourceCommit:"c".repeat(40),receipt,evaluatedAt:"2026-10-04T19:05:00.000Z"}),/contradictory/);
console.log("B279 strict commercial launch authorization browser contract: PASS");
