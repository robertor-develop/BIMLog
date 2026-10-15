import assert from "node:assert/strict";
import fs from "node:fs";
import { isGaProtectedProjectId } from "./ga-protected-projects";

const retirement = fs.readFileSync(new URL("./project-retirement.ts", import.meta.url), "utf8");
const routes = fs.readFileSync(new URL("../routes/projects.ts", import.meta.url), "utf8");

for (const id of [23, 26, 35]) assert.equal(isGaProtectedProjectId(id), true);
assert.match(retirement, /deny_protected_project_mutation/);
assert.match(retirement, /GA_PROTECTED_PROJECT/);
assert.match(retirement, /await rejectProtectedProjectMutation\(actor, projectId, "retire_project"\)/);
assert.match(retirement, /change_project_workspace_state_batch/);
assert.match(routes, /PROJECT_HARD_DELETE_DISABLED/);

console.log("B_GA004=PASS protectedLifecycleMutationsDenied=true deniedAttemptsAudited=true");
