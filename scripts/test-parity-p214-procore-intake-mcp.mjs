import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const panel = read("artifacts/bimlog/src/pages/project/ProcoreIntakePanel.tsx");
const routes = read("artifacts/api-server/src/routes/agents.ts");
const mcp = read("artifacts/api-server/src/lib/procore-intake-mcp.ts");

for (const token of ['method: "tools/list"', 'method: "tools/call"', 'name: "procore_browse"', 'name:"bimlog_propose_intake_plan"', "versionId", "sourceCompanyId"]) assert.ok(panel.includes(token), `MCP UI missing ${token}`);
for (const token of ['router.post("/projects/:projectId/intake-agent/mcp"', "requireProjectMember()", 'method==="tools/list"', 'method==="tools/call"', "discoverIntakeTools", "callIntakeTool"]) assert.ok(routes.includes(token), `MCP route missing ${token}`);
for (const token of ['name: "procore_browse"', 'name: "bimlog_propose_intake_plan"', "isProviderOperationCurrentlyAllowed", "PROVIDER_NOT_APPROVED", "canonicalMutation: false", "versionPinned: true", "PROCORE_VERSION_UNAVAILABLE", "PROCORE_SOURCE_CHANGED"]) assert.ok(mcp.includes(token), `MCP contract missing ${token}`);
assert.ok(!mcp.includes('name: "procore_import"'), "agent MCP must not expose canonical import");

console.log("PASS P214 MCP discovery, governed browse and version-pinned proposal-only contracts");
