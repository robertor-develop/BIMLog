import assert from "node:assert/strict";
import {deriveCommercialLaunchAuthorization} from "./commercial-launch-authorization";
import type {StoredCommercialVerification} from "./commercial-launch-verification-store";

const source="a".repeat(40),now=new Date("2026-10-04T19:05:00.000Z");
const receipt:StoredCommercialVerification={id:"receipt",actorUserId:7,sourceCommit:source,status:"verified",verified:true,checkedAt:"2026-10-04T19:00:00.000Z",validUntil:"2026-10-04T19:15:00.000Z",checkCount:1,failedCheckIds:[],checks:[{id:"stripe.account",status:"verified",code:"account_verified"}],evidenceSha256:"b".repeat(64),recordedAt:"2026-10-04T19:00:01.000Z"};
assert.deepEqual(deriveCommercialLaunchAuthorization({sourceCommit:source,receipt,now}).status,"current");
assert.equal(deriveCommercialLaunchAuthorization({sourceCommit:source,receipt:null,now}).status,"missing");
assert.equal(deriveCommercialLaunchAuthorization({sourceCommit:"c".repeat(40),receipt,now}).status,"source_mismatch");
assert.equal(deriveCommercialLaunchAuthorization({sourceCommit:source,receipt:{...receipt,validUntil:"2026-10-04T19:04:00.000Z"},now}).status,"expired");
assert.equal(deriveCommercialLaunchAuthorization({sourceCommit:source,receipt:{...receipt,status:"failed",verified:false},now}).status,"not_verified");
assert.throws(()=>deriveCommercialLaunchAuthorization({sourceCommit:"short",receipt,now}),/IDENTITY/);
console.log("B276 canonical durable commercial launch authorization: PASS");
