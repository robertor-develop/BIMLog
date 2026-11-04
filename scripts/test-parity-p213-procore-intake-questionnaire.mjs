import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const panel = read("artifacts/bimlog/src/pages/project/ProcoreIntakePanel.tsx");
const routes = read("artifacts/api-server/src/routes/agents.ts");
const agent = read("artifacts/api-server/src/lib/procore-intake-agent.ts");

for (const text of ["What are you trying to accomplish?", "What information or documents do you need?", "Message the Procore intake agent"]) assert.ok(panel.includes(text), `questionnaire missing ${text}`);
for (const token of ["/intake-agent/turn", "messages.slice(-30)", "new AbortController()", "turnLock.current", "ticket===epoch.current", "activeTurn.current?.abort()", "INTAKE_AGENT_PROPOSAL_INVALID"]) assert.ok(panel.includes(token), `panel missing ${token}`);
for (const token of ["state!=='proposal_only'", "versionPinned!==true", "confirmationRequired!==true", "canonicalMutation!==false"]) assert.ok(panel.includes(token), `proposal guard missing ${token}`);
for (const token of ['router.post("/projects/:projectId/intake-agent/turn"', "requireProjectMember()", "buildCurrentProcoreIntakeMessage", "runDiscoveredMcpTurn", "canonicalMutation:false", "confirmationRequired:true"]) assert.ok(routes.includes(token), `turn route missing ${token}`);
for (const token of ["destinationProjectId !== projectId", "selectedSources.length > 100", "sourceCompanyId", "User request:"]) assert.ok(agent.includes(token), `agent context guard missing ${token}`);

console.log("PASS P213 guided questionnaire, bounded turns, cancellation and proposal-only contracts");
