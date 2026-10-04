import assert from "node:assert/strict";
import {parseCommercialVerificationHistory} from "./commercial-launch-client";

const item={id:"receipt-1",actorUserId:7,sourceCommit:"a".repeat(40),status:"failed",verified:false,checkedAt:"2026-10-04T18:00:00.000Z",validUntil:"2026-10-04T18:15:00.000Z",checkCount:1,failedCheckIds:["stripe.account"],checks:[{id:"stripe.account",status:"failed",code:"ACCOUNT_REJECTED"}],evidenceSha256:"b".repeat(64),recordedAt:"2026-10-04T18:00:01.000Z"};
assert.equal(parseCommercialVerificationHistory({items:[item]})[0].checks[0].code,"ACCOUNT_REJECTED");
assert.throws(()=>parseCommercialVerificationHistory({items:[{...item,sourceCommit:"bad"}]}),/invalid/);
assert.throws(()=>parseCommercialVerificationHistory({items:[{...item,verified:true}]}),/contradictory/);
console.log("B274 strict commercial verification history client: PASS");
