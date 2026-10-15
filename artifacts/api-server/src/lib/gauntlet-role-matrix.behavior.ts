import assert from "node:assert/strict";
import { expectedGauntletRoleDecision, GAUNTLET_ACTIONS, GAUNTLET_PERSONAS, inspectGauntletRoleMatrix } from "./gauntlet-role-matrix";

const decisions = GAUNTLET_PERSONAS.flatMap(persona => GAUNTLET_ACTIONS.map(action => {
  const allowed = expectedGauntletRoleDecision(persona, action);
  return { persona, action, allowed, status: allowed ? 200 : 403, code: allowed ? "AUTHORIZED" : "PROJECT_ROLE_FORBIDDEN" };
}));
assert.deepEqual(inspectGauntletRoleMatrix(decisions), { ready: true, missing: [], mismatches: [] });
assert.equal(expectedGauntletRoleDecision("read_only", "files"), false);
assert.equal(expectedGauntletRoleDecision("project_administrator", "deletion"), true);
const elevatedReadOnly = decisions.map(row => row.persona === "read_only" && row.action === "files" ? { ...row, allowed: true, status: 200, code: "AUTHORIZED" } : row);
assert.deepEqual(inspectGauntletRoleMatrix(elevatedReadOnly).mismatches, ["read_only:files"]);
assert.equal(inspectGauntletRoleMatrix(decisions.slice(1)).missing.length, 1);
assert.throws(() => inspectGauntletRoleMatrix([...decisions, decisions[0]]), /DECISION_DUPLICATE/);
console.log("B-GA014 five-persona positive and negative permission matrix: PASS");
