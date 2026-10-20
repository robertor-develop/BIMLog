import assert from "node:assert/strict";
import { validateProcoreRfiJourney } from "./lib/live-journey-acceptance.mjs";
const identity={kind:"procore-rfi",sourceCommit:"a".repeat(40),assetManifestSha256:"b".repeat(64),packageId:"pkg",schemaVersion:"schema-1",observedAt:"2026-10-20T12:00:00Z",protectedProjectsUnchanged:true};
const pass={...identity,status:"PASS",safeTestProject:true,correlationId:"procore-rfi-test-001",checks:{preview:true,commit:true,idempotentReplay:true,conflict:true,rollback:true,auditHistory:true}};
const blocked={...identity,status:"BLOCKED_EXTERNAL",blockerCode:"NO_CONNECTED_ACCOUNT",dataMutated:false};
assert.equal(validateProcoreRfiJourney(pass).ok,true);assert.equal(validateProcoreRfiJourney(blocked).ok,true);
for(const check of Object.keys(pass.checks)){const invalid=structuredClone(pass);invalid.checks[check]=false;assert.equal(validateProcoreRfiJourney(invalid).ok,false,check);}
const unsafe=structuredClone(pass);unsafe.safeTestProject=false;assert.equal(validateProcoreRfiJourney(unsafe).ok,false);
console.log("LIVE_JOURNEY_BUILD009_CONTRACT_PASS fixture=synthetic liveAcceptance=false rfiChecks=6");
