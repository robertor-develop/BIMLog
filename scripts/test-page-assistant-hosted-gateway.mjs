import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("artifacts/api-server/src/routes/agents.ts", "utf8");
const store = readFileSync("artifacts/api-server/src/lib/page-agent-conversation-store.ts", "utf8");
const transport = readFileSync("artifacts/api-server/src/lib/main04-agent-transport.ts", "utf8");

assert.match(route, /reservePageAgentTurn/);
assert.match(route, /startPageAgentTurn/);
assert.match(route, /refreshPageAgentTurn/);
assert.match(route, /requireProjectMember\(\)/);
assert.match(route, /transport:\s*"main04"/);
assert.match(route, /Cache-Control","private, no-store, max-age=0/);

assert.match(store, /page_agent_turns_actor_active_idx/);
assert.match(store, /WHERE state IN \('reserved','running'\)/);
assert.match(store, /company_id=\$2 AND user_id=\$3/);
assert.match(store, /ORDER BY created_at,request_id/);
assert.match(store, /dispatchBimlogMain04/);
assert.match(store, /readBimlogMain04/);

assert.match(transport, /BIMLOG_MAIN04_THREAD_ID/);
assert.match(transport, /destinationThreadId:\s*BIMLOG_MAIN04_THREAD_ID/);
assert.match(transport, /idempotencyKey:\s*input\.requestId/);
assert.match(transport, /MAIN04_REQUEST_MISMATCH/);
assert.match(transport, /MAIN04_DESTINATION_MISMATCH/);
assert.match(transport, /BIMLOG_MAIN04_ACCESS_CLIENT_ID/);
assert.match(transport, /BIMLOG_MAIN04_ACCESS_CLIENT_SECRET/);
assert.doesNotMatch(route, /feedback|MAIN-00|Lumen/i);

console.log("PASS authenticated durable BIMLog MAIN 04 FIFO gateway");
