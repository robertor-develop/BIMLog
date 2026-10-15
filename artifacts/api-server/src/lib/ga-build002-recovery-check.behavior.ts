import assert from "node:assert/strict";
import { checkProtectedProjectRecovery } from "./ga-protected-project-recovery";

const result = checkProtectedProjectRecovery([
  { id: 23, code: "IBQ-LIT", name: "IBQ Lithium Extraction Plant", status: "active", memberCount: 1, fileCount: 2 },
  { id: 26, code: "ELA01", name: "ELARA EAST ", status: "active", memberCount: 1, fileCount: 14 },
  { id: 35, code: "PRO-521-TEST", name: "521 E TREMONT TEST PROJECT", status: "active", memberCount: 1, fileCount: 0 },
]);

assert.equal(result.length, 3);
assert.equal(result.every(project => project.active && project.identityMatches && !project.restorationRequired), true);
assert.deepEqual(result.flatMap(project => project.issues), []);
assert.equal(checkProtectedProjectRecovery([]).every(project => project.issues.includes("missing_from_authoritative_roster")), true);

console.log("B_GA002=PASS protectedProjectsActive=true restorationMutation=false");
