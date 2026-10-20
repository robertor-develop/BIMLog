import assert from "node:assert/strict";
import { validateProjectLifecycleJourney } from "./lib/live-journey-acceptance.mjs";
const modules=Object.fromEntries(["documents","rfis","submittals","transmittals","meetings","schedule","apus","edt-wbs"].map(name=>[name,{loaded:true,projectId:23,consoleErrors:0}]));
const receipt={kind:"project-lifecycle",sourceCommit:"a".repeat(40),assetManifestSha256:"b".repeat(64),packageId:"pkg",schemaVersion:"schema-1",observedAt:"2026-10-20T12:00:00Z",authenticated:true,readOnly:true,projectId:23,modules,denials:{crossTenant:403,insufficientRole:403,anonymous:401}};
assert.equal(validateProjectLifecycleJourney(receipt).ok,true);
for(const mutate of [v=>v.readOnly=false,v=>v.modules.rfis.loaded=false,v=>v.modules.apus.projectId=26,v=>v.denials.crossTenant=200]){const invalid=structuredClone(receipt);mutate(invalid);assert.equal(validateProjectLifecycleJourney(invalid).ok,false);}
console.log("LIVE_JOURNEY_BUILD007_CONTRACT_PASS fixture=synthetic liveAcceptance=false modules=8 denials=3");
