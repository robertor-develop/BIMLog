import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync(
  new URL("../routes/project_directory.ts", import.meta.url),
  "utf8",
);
const ui = fs.readFileSync(
  new URL("../../../bimlog/src/pages/project/DirectoryTab.tsx", import.meta.url),
  "utf8",
);

assert.match(
  route,
  /router\.get\(\s*"\/projects\/:projectId\/directory",\s*authMiddleware,\s*requireProjectMember\(\)/s,
);
assert.match(
  route,
  /router\.get\(\s*"\/projects\/:projectId\/directory\/export-pdf",\s*authMiddleware,\s*requireProjectMember\(\)/s,
);
assert.match(
  route,
  /from\(projectDirectoryTable\)\s*\.where\(eq\(projectDirectoryTable\.projectId, projectId\)\)/s,
);

for (const path of [
  "/projects/:projectId/directory",
  "/projects/:projectId/directory/companies",
  "/projects/:projectId/directory/contacts",
  "/projects/:projectId/directory/:entryId",
  "/projects/:projectId/directory/:entryId/invite",
  "/projects/:projectId/directory/import",
]) {
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.match(
    route,
    new RegExp(`router\\.(?:post|patch|delete)\\(\\s*"${escaped}",\\s*authMiddleware,\\s*requirePermission\\("admin", "write"\\)`, "s"),
    `${path} must enforce server-side project write permission`,
  );
}

const inviteRoute = route.match(
  /router\.post\(\s*"\/projects\/:projectId\/directory\/:entryId\/invite"[\s\S]*?\n\s*\},\s*\n\s*\);/,
)?.[0];
assert.ok(inviteRoute, "invite route must exist");
assert.match(
  inviteRoute,
  /eq\(projectDirectoryTable\.id, entryId\)[\s\S]*eq\(projectDirectoryTable\.projectId, projectId\)/,
  "invite read and post-invite status update must remain project-scoped",
);
assert.equal(
  (inviteRoute.match(/eq\(projectDirectoryTable\.projectId, projectId\)/g) || []).length >= 2,
  true,
  "invite route must project-scope both its initial read and its status update",
);

assert.match(ui, /fetch\(`\$\{API\}\/projects\/\$\{projectId\}\/directory`/);
assert.match(ui, /fetch\(`\$\{API\}\/projects\/\$\{projectId\}\/members`/);
assert.equal(
  (ui.match(/\{canWrite &&/g) || []).length >= 4,
  true,
  "Directory mutation controls must remain gated by canWrite",
);

console.log("POST-P18 Build 71 Project Directory identity/scope: PASS");
