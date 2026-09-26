import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../routes/folder-wizard-routing.ts", import.meta.url), "utf8");
assert.match(route, /router\.post\("\/projects\/:projectId\/integrations\/folder-wizard\/publishing-candidate", authMiddleware, requireProjectMember\(\)/);
assert.match(route, /candidate\.preview\(\{ \.\.\.scope, fileId, tags \}\)/);
assert.match(route, /router\.post\("\/projects\/:projectId\/integrations\/folder-wizard\/publish", authMiddleware, requireProjectMember\(\)/);
assert.match(route, /createRuntimeFolderWizardPublishSubmission\(\)\)\.submit/);
assert.match(route, /executeConfirmedFolderWizardPublish\(submitted\.jobId, scope\)/);
assert.match(route, /router\.get\("\/projects\/:projectId\/integrations\/folder-wizard\/destination", authMiddleware, requireProjectMember\(\)/);
assert.match(route, /router\.post\("\/projects\/:projectId\/integrations\/folder-wizard\/destination", authMiddleware, requireProjectMember\("project_admin"\)/);
assert.match(route, /destinations\.create\(getScope\(req\), req.body\)/);
console.log("Folder Wizard candidate and confirmed publication routes: PASS");
