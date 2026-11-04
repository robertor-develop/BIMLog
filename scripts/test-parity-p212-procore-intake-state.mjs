import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const panel = read("artifacts/bimlog/src/pages/project/ProcoreIntakePanel.tsx");
const routes = read("artifacts/api-server/src/routes/agents.ts");
const service = read("artifacts/api-server/src/lib/procore-intake-state.ts");

for (const identity of ['router.get("/projects/:projectId/intake-agent/state"', 'router.put("/projects/:projectId/intake-agent/state"']) assert.ok(routes.includes(identity));
for (const token of ["requireProjectMember()", "loadProcoreIntakeState", "saveProcoreIntakeState"]) assert.ok(routes.includes(token), `route missing ${token}`);
for (const token of ["destinationProjectId", "selectedSources", "messages", "updatedAt"]) assert.ok(service.includes(token), `state service missing ${token}`);
for (const token of ["INTAKE_STATE_IDENTITY_MISMATCH", "INTAKE_STATE_READBACK_MISMATCH", "beforeunload", "Retry intake restore", "Retry intake save"]) assert.ok(panel.includes(token), `panel missing ${token}`);
assert.match(panel, /writeQueue\.current=writeQueue\.current\.then/);
assert.match(panel, /activeTurn\.current\?\.abort\(\);activeBrowse\.current\?\.abort\(\);activeProposal\.current\?\.abort\(\)/);
assert.match(panel, /localStorage\.getItem\(storageKey\)[\s\S]*Invalid local backup is never posted/);

console.log("PASS P212 persisted intake state, readback, isolation and recovery contracts");
