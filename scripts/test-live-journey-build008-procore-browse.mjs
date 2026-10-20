import assert from "node:assert/strict";
import { validateProcoreBrowseJourney } from "./lib/live-journey-acceptance.mjs";
const identity={kind:"procore-browse",sourceCommit:"a".repeat(40),assetManifestSha256:"b".repeat(64),packageId:"pkg",schemaVersion:"schema-1",observedAt:"2026-10-20T12:00:00Z",continuousSyncClaimed:false};
const pass={...identity,status:"PASS",authenticatedAccount:true,companyListLoaded:true,projectListLoaded:true,folderListLoaded:true,authorizedDownload:{status:200,sha256:"c".repeat(64)},auditEventRecorded:true};
const blocked={...identity,status:"BLOCKED_EXTERNAL",blockerCode:"NO_CONNECTED_ACCOUNT",dataMutated:false};
assert.equal(validateProcoreBrowseJourney(pass).ok,true);assert.equal(validateProcoreBrowseJourney(blocked).ok,true);
for(const mutate of [v=>v.continuousSyncClaimed=true,v=>v.authorizedDownload.status=403,v=>v.auditEventRecorded=false]){const invalid=structuredClone(pass);mutate(invalid);assert.equal(validateProcoreBrowseJourney(invalid).ok,false);}
const vague=structuredClone(blocked);vague.blockerCode="UNTESTED";assert.equal(validateProcoreBrowseJourney(vague).ok,false);
console.log("LIVE_JOURNEY_BUILD008_CONTRACT_PASS fixture=synthetic liveAcceptance=false externalBlockerExplicit=true");
