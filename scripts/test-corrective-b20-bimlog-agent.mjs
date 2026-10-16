import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
for(const file of ["scripts/test-page-assistant-block01.mjs","scripts/test-page-assistant-hosted-gateway.mjs","scripts/bimlog-main04-local-bridge.behavior.mjs"])
  execFileSync(process.execPath,[file],{stdio:"inherit"});
const panel=readFileSync("artifacts/bimlog/src/components/layout/PageAssistant.tsx","utf8");
const routes=readFileSync("artifacts/api-server/src/routes/agents.ts","utf8");
const store=readFileSync("artifacts/api-server/src/lib/page-agent-conversation-store.ts","utf8");
assert.match(panel,/page-assistant-coming-soon/);
assert.match(panel,/aria-disabled="true"/);
assert.match(routes,/requireProjectMember\(\)/);
assert.match(store,/company_id=\$2 AND user_id=\$3/);
assert.match(store,/state='failed'/);
assert.match(store,/state='complete'/);
assert.match(store,/ORDER BY created_at,request_id/);
console.log("CORRECTIVE-B20 BIMLog Agent page context, durable conversation, failure recovery and permissions: PASS");
