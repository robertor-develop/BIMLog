import assert from "node:assert/strict";
import { assistantInstructionDigest, cleanAssistantList, cleanAssistantText, parseAssistantAnswer } from "./page-assistant-agent-contract";

assert.equal(cleanAssistantText("  hello\u0000world  ", 20), "hello world");
assert.deepEqual(cleanAssistantList(["Perspective", "Perspective", "Counterparty"], 10, 120), ["Perspective", "Counterparty"]);
assert.deepEqual(parseAssistantAnswer('{"answer":"Perspective determines whether this is an owner contract or a commitment.","highlightLabels":["Perspective","Invented"]}', ["Perspective"]), {
  answer: "Perspective determines whether this is an owner contract or a commitment.",
  highlightLabels: ["Perspective"],
});
assert.throws(() => parseAssistantAnswer('{"answer":"ok","connected":true}', []), /ASSISTANT_RESPONSE_UNAUTHORIZED_FIELD/);
assert.throws(() => parseAssistantAnswer("not json", []), /ASSISTANT_RESPONSE_MALFORMED/);
assert.match(assistantInstructionDigest("bimlog-agent-v1"), /^[0-9a-f]{64}$/);
console.log("PASS page assistant dedicated-agent contract");
