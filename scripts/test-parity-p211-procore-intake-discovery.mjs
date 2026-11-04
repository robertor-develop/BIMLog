import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const directory = read("artifacts/bimlog/src/lib/capability-directory.ts");
const panel = read("artifacts/bimlog/src/pages/project/ProcoreIntakePanel.tsx");
const integrations = read("artifacts/bimlog/src/pages/project/IntegrationsTab.tsx");
const agents = read("artifacts/api-server/src/routes/agents.ts");
const imports = read("artifacts/api-server/src/routes/procore_document_import.ts");

assert.match(directory, /id:"procore-guided-intake"[\s\S]*href:"\/projects\/:projectId\/integrations#procore-guided-intake"[\s\S]*projectRequired:true/);
for (const token of ["questionnaire", "MCP", "versions", "receipts", "explicitly confirm"]) assert.ok(directory.includes(token), `directory missing ${token}`);
assert.ok(integrations.includes("<ProcoreIntakePanel") && integrations.includes('id="procore-guided-intake"') === false, "guided intake must remain the working integrations module");
assert.match(panel, /id="procore-guided-intake"[\s\S]*What are you trying to accomplish\?[\s\S]*What information or documents do you need\?/);
for (const identity of [
  'router.get("/projects/:projectId/intake-agent/state"',
  'router.put("/projects/:projectId/intake-agent/state"',
  'router.post("/projects/:projectId/intake-agent/mcp"',
  'router.post("/projects/:projectId/intake-agent/turn"',
]) assert.ok(agents.includes(identity), `missing ${identity}`);
for (const identity of [
  'router.post("/projects/:projectId/files/procore/preview"',
  'router.post("/projects/:projectId/files/procore/import"',
  'router.get("/projects/:projectId/files/procore/receipts/:requestId"',
]) assert.ok(imports.includes(identity), `missing ${identity}`);

console.log("PASS P211 seven post-freeze Procore/intake routes are adjudicated and directly discoverable");
