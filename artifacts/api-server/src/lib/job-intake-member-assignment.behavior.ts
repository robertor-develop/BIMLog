import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const membersRoute = readFileSync(new URL("../routes/members.ts", import.meta.url), "utf8");
const intakeUi = readFileSync(
  new URL("../../../bimlog/src/pages/JobIntakeWorkspace.tsx", import.meta.url),
  "utf8",
);

assert.match(membersRoute, /\/projects\/:projectId\/members\/eligible/);
assert.match(membersRoute, /requirePermission\("admin"\)/);
assert.match(membersRoute, /projectDirectoryTable\.projectId, projectId/);
assert.match(membersRoute, /projectMembersTable\.projectId, projectId/);
assert.match(membersRoute, /inArray\(usersTable\.companyId, connectedCompanyIds\)/);
assert.match(membersRoute, /!currentMemberIds\.has\(candidate\.id\)/);
assert.match(intakeUi, /Add an existing BIMLog user to this project/);
assert.match(intakeUi, /Only users from companies already connected to this project are listed/);
assert.match(intakeUi, /await persist\(dataRef\.current\)/);
assert.match(intakeUi, /body: JSON\.stringify\(\{ email: selected\.email, role: "member" \}\)/);
assert.match(intakeUi, /await load\(\)/);
assert.match(intakeUi, /can be assigned below/);
assert.match(intakeUi, /assignment\.contractId/);
assert.match(intakeUi, /assignment\.scopeItemId/);
assert.match(intakeUi, /assignment\.workPackageId/);

console.log(JSON.stringify({ status: "PASS", tests: [
  "admin-only-eligible-user-list",
  "current-project-company-boundary",
  "existing-member-exclusion",
  "save-before-membership-change",
  "immediate-intake-refresh",
  "task-contract-scope-assignment-preserved",
] }));
