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
assert.match(store, /answerBimlogMain04/);
assert.match(store, /MAIN04_PROVIDER_TIMEOUT/);
assert.match(store, /await complete\(input\.requestId,result\.answer\)/);
assert.match(store, /state='failed'/);

assert.match(transport, /BIMLOG_MAIN04_THREAD_ID/);
assert.match(transport, /getAnthropicClientForUser/);
assert.match(transport, /resolveBimlogDedicatedAgent/);
assert.match(transport, /feature:\s*"bimlog_page_assistant"/);
assert.match(transport, /tenant:\s*\{ companyId: input\.companyId, projectId: input\.projectId \}/);
assert.match(transport, /visibleControls:\s*input\.context\.controls/);
assert.match(transport, /allowed\.has\(label\)/);
assert.match(transport, /temperature:\s*0/);
assert.doesNotMatch(route, /feedback|MAIN-00|Lumen/i);

console.log("PASS authenticated durable BIMLog dedicated provider gateway");
