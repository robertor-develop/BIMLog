import assert from "node:assert/strict";
import { validateAuthenticatedShellJourney } from "./lib/live-journey-acceptance.mjs";
const receipt={kind:"authenticated-shell",sourceCommit:"a".repeat(40),assetManifestSha256:"b".repeat(64),packageId:"pkg",schemaVersion:"schema-1",observedAt:"2026-10-20T12:00:00Z",authenticated:true,visibleChrome:true,consoleErrors:0,pageErrors:0,viewports:[{width:1440,height:900,mode:"split",horizontalOverflow:false,mainVisible:true,agentVisible:true},{width:820,height:1180,mode:"split",horizontalOverflow:false,mainVisible:true,agentVisible:true},{width:390,height:844,mode:"fullscreen",horizontalOverflow:false,mainVisible:false,agentVisible:true}]};
assert.equal(validateAuthenticatedShellJourney(receipt).ok,true);
for(const mutate of [v=>v.authenticated=false,v=>v.viewports[1].horizontalOverflow=true,v=>v.viewports.pop(),v=>v.consoleErrors=1]){const invalid=structuredClone(receipt);mutate(invalid);assert.equal(validateAuthenticatedShellJourney(invalid).ok,false);}
console.log("LIVE_JOURNEY_BUILD006_CONTRACT_PASS fixture=synthetic liveAcceptance=false");
