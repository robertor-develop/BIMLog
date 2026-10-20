import assert from "node:assert/strict";
import { validateAgentJourney } from "./lib/live-journey-acceptance.mjs";
const turn=(page)=>({question:`What page is ${page}?`,answer:page,requestId:`req-${page}`,correlatedRequestId:`req-${page}`,conversationId:"conv-1",correlatedConversationId:"conv-1",persistedAfterReload:true});
const receipt={kind:"agent-correlated",sourceCommit:"a".repeat(40),assetManifestSha256:"b".repeat(64),packageId:"pkg",schemaVersion:"schema-1",observedAt:"2026-10-20T12:00:00Z",authenticated:true,tenantIsolationDenied:true,turns:{headquarters:turn("headquarters"),project:turn("project")},navigationPreservedConversation:true,consoleErrors:0};
assert.equal(validateAgentJourney(receipt).ok,true);
for(const mutate of [v=>v.turns.project.correlatedRequestId="other",v=>v.turns.headquarters.persistedAfterReload=false,v=>v.navigationPreservedConversation=false,v=>v.tenantIsolationDenied=false]){const invalid=structuredClone(receipt);mutate(invalid);assert.equal(validateAgentJourney(invalid).ok,false);}
console.log("LIVE_JOURNEY_BUILD010_CONTRACT_PASS fixture=synthetic liveAcceptance=false pages=2");
