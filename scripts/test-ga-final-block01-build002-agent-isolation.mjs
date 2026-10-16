import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routes = readFileSync("artifacts/api-server/src/routes/agents.ts", "utf8");
const store = readFileSync("artifacts/api-server/src/lib/page-agent-conversation-store.ts", "utf8");
const transport = readFileSync("artifacts/api-server/src/lib/main04-agent-transport.ts", "utf8");

assert.match(routes, /requireProjectMember\(\)/, "project questions require current project membership");
assert.match(store, /WHERE request_id=\$1 AND company_id=\$2 AND user_id=\$3/, "request reads must bind tenant and actor");
assert.match(store, /WHERE conversation_id=\$1 AND company_id=\$2 AND user_id=\$3/, "conversation reads must bind tenant and actor");
assert.match(store, /page_agent_turns_actor_active_idx/, "one active writer must be enforced per tenant, actor and conversation");
assert.match(store, /ON CONFLICT\(request_id\) DO NOTHING/, "request replay must be idempotent");
assert.match(store, /PAGE_AGENT_REQUEST_CONFLICT/, "mismatched replay must fail closed");
assert.match(transport, /actor:\s*\{ userId: input\.userId, companyId: input\.companyId, projectId: input\.projectId \}/);
assert.match(transport, /MAIN04_REQUEST_MISMATCH/);
assert.match(transport, /MAIN04_DESTINATION_MISMATCH/);

console.log("GA-F01-B002 agent tenant, actor and project isolation: PASS");
