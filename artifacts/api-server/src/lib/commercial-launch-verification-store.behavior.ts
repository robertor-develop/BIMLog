import assert from "node:assert/strict";
import {recordCommercialLaunchVerification,readCommercialLaunchVerificationHistory} from "./commercial-launch-verification-store";

const row={id:"launch-verification-"+"b".repeat(64),actor_user_id:7,source_commit:"a".repeat(40),status:"failed",verified:"false",checked_at:"2026-10-04T18:00:00.000Z",valid_until:"2026-10-04T18:15:00.000Z",check_count:1,failed_check_ids_json:'["stripe.account"]',checks_json:'[{"id":"stripe.account","status":"failed","code":"ACCOUNT_REJECTED"}]',evidence_sha256:"b".repeat(64),recorded_at:"2026-10-04T18:00:01.000Z"};
const calls:{text:string;values:unknown[]}[]=[];
const client={query:async(text:string,values:unknown[]=[])=>{calls.push({text,values});if(text.startsWith("SELECT * FROM commercial_launch_verifications WHERE"))return {rows:[row]};if(text.startsWith("SELECT * FROM commercial_launch_verifications ORDER"))return {rows:[row]};return {rows:[]};}};
const stored=await recordCommercialLaunchVerification(client as never,7,{status:"failed",verified:false,checkedAt:row.checked_at,checks:[{id:"stripe.account",status:"failed",code:"ACCOUNT_REJECTED"}],evidence:{schemaVersion:"bimlog-commercial-verification-v1",sourceCommit:row.source_commit,status:"failed",verified:false,checkedAt:row.checked_at,validUntil:row.valid_until,checkCount:1,failedCheckIds:["stripe.account"],evidenceSha256:row.evidence_sha256}});
assert.equal(stored.actorUserId,7);assert.equal(stored.checks[0].code,"ACCOUNT_REJECTED");assert.equal(calls[0].values.some(value=>String(value).includes("secret")),false);assert.match(calls[0].text,/ON CONFLICT \(evidence_sha256\) DO NOTHING/);
const history=await readCommercialLaunchVerificationHistory(client as never,10);assert.equal(history.length,1);assert.equal(history[0].sourceCommit,"a".repeat(40));
await assert.rejects(()=>readCommercialLaunchVerificationHistory(client as never,26),/limit/);
console.log("B272 immutable commercial verification receipts: PASS");
