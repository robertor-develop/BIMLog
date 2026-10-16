import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { queuedAgentAnswer } from "./bimlog-main04-local-bridge.mjs";
const source = readFileSync(new URL("./bimlog-main04-local-bridge.mjs", import.meta.url), "utf8");
assert.match(source, /queue\.then\(work, work\)/);
assert.match(source, /destinationThreadId !== THREAD_ID/);
assert.match(source, /EXACT_QUESTION=/);
assert.match(source, /"exec", "--skip-git-repo-check", "resume"/);
assert.match(source, /"--all", "-m", THREAD_MODEL/);
assert.match(source, /model_reasoning_effort=\"low\"/);
assert.match(source, /--skip-git-repo-check/);
assert.match(source, /--output-last-message/);
assert.match(source, /child\.stdin\.end\(message\)/);
assert.match(source, /state: "QUEUED"/);
assert.match(source, /\/bimlog\\\/main04\\\/\(\[A-Za-z0-9-\]/);
assert.match(source, /timingSafeEqual/);
assert.match(source, /resumeQuestionWithRetry/);
assert.match(source, /CODEX_DESTINATION_BUSY/);
assert.match(source, /return queueQuestion\(message\)/);
assert.match(source, /"queue", "-C", "F:\\\\BIMLog", "--thread", THREAD_ID, "--message", message/);
assert.match(source, /queuedAgentAnswer/);
assert.match(source, /requestId: payload\.requestId/);
assert.match(source, /jobs\.has\(payload\.requestId\)/);
assert.match(source, /runtimeReadiness/);
assert.match(source, /request\.url === "\/readyz"/);
assert.match(source, /codexReady/);
assert.match(source, /rolloutReady/);
const prompt = "BIMLOG_REQUEST_ID=fixture\nEXACT_QUESTION=\"What page?\"";
const fixture = Buffer.from([
  JSON.stringify({ type:"event_msg", payload:{ turn_id:"turn-fixture", item:{ type:"UserMessage", content:[{ type:"text", text:prompt }] } } }),
  JSON.stringify({ type:"event_msg", payload:{ turn_id:"turn-fixture", item:{ type:"AgentMessage", phase:"final_answer", content:[{ type:"Text", text:"BIMLog Headquarters" }] } } }),
].join("\n"));
assert.equal(queuedAgentAnswer(fixture,prompt),"BIMLog Headquarters");
assert.equal(queuedAgentAnswer(fixture,"different prompt"),null);
assert.doesNotMatch(source, /MAIN-00|Feedback Agent|operations-dashboard/i);
console.log("BIMLog MAIN 04 local bridge contract: PASS");
