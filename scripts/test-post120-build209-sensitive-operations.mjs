import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const route = (name) => fs.readFileSync(path.join(root, `artifacts/api-server/src/routes/${name}.ts`), "utf8");

const files = route("files");
assert.match(files, /router\.post\(\s*["']\/projects\/:projectId\/files["'][\s\S]{0,300}authMiddleware[\s\S]{0,300}requirePermission\(/, "file upload must require explicit write permission");
assert.match(files, /files\/current-view\.pdf[\s\S]{0,300}authMiddleware[\s\S]{0,300}requireProjectMember\(/, "file export must require project membership");
assert.match(files, /eq\(filesTable\.id, fileId\),\s*eq\(filesTable\.projectId, projectId\)/, "file object lookup must bind project and object");

const ai = route("ai-control-plane");
assert.match(ai, /router\.use\([\s\S]{0,180}authMiddleware/, "AI control plane must authenticate every protected path");
assert.match(ai, /CROSS_COMPANY_FORBIDDEN/, "AI control plane must deny cross-company authority");
assert.match(ai, /requireSuper\(/, "system AI authority must remain super-admin only");

const lens = route("clash_reports");
for (const operation of ["plugin-sync", "plugin-pull"]) {
  const index = lens.indexOf(operation);
  assert.ok(index >= 0, `missing Lens Next ${operation}`);
  const boundary = lens.slice(index, index + 6500);
  assert.match(boundary, /authMiddleware/, `Lens Next ${operation} must authenticate`);
  assert.match(boundary, /require(ProjectMember|Permission)\(/, `Lens Next ${operation} must bind project authority`);
}

console.log("POST120_BUILD209=PASS upload=guarded export=guarded ai=tenant-bound lens-next=project-bound");
