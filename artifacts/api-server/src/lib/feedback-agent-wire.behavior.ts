import assert from "node:assert/strict";
import { FEEDBACK_AGENT_LEASE_SECONDS, FEEDBACK_AGENT_MAX_ATTEMPTS, feedbackAgentMac, feedbackAgentRequestBytes, feedbackAgentResponseBytes, safeFeedbackAgentMacEqual } from "./feedback-agent-wire";

const key="synthetic-feedback-commissioning-key-000000000000";
const nonce="11111111-1111-4111-8111-111111111111";
const requestBody=JSON.stringify({worker:"synthetic-worker",contractVersion:"feedback-case/v1",targetAgentId:"01a10d7d-ffa2-71e2-a085-ec1b954a3d4f"});
const requestMac=feedbackAgentMac(key,feedbackAgentRequestBytes(nonce,"/api/feedback-agent/claim",requestBody));
assert.match(requestMac,/^[a-f0-9]{64}$/);
assert.equal(safeFeedbackAgentMacEqual(requestMac,requestMac),true);
assert.equal(safeFeedbackAgentMacEqual("0".repeat(64),requestMac),false);
const responseBody=JSON.stringify({contractVersion:"feedback-case/v1",targetAgentId:"01a10d7d-ffa2-71e2-a085-ec1b954a3d4f",case:null});
assert.notEqual(feedbackAgentMac(key,feedbackAgentResponseBytes(nonce,200,responseBody)),feedbackAgentMac(key,feedbackAgentResponseBytes(nonce,409,responseBody)));
assert.equal(FEEDBACK_AGENT_MAX_ATTEMPTS,3);
assert.equal(FEEDBACK_AGENT_LEASE_SECONDS,300);
console.log("Feedback Agent signed and bounded wire contract: PASS");
