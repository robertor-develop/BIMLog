import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

for (const target of ["test:folder-wizard-publish-block05", "test:folder-wizard-publish-block06"]) {
  const run = spawnSync(`pnpm run ${target}`, { encoding: "utf8", shell: true });
  assert.equal(run.status, 0, `${target}\n${run.stdout ?? ""}\n${run.stderr ?? run.error ?? ""}`);
}
const routes = readFileSync("artifacts/api-server/src/routes/index.ts", "utf8");
const panel = readFileSync("artifacts/bimlog/src/pages/project/FolderWizardImportPanel.tsx", "utf8");
assert.match(routes, /folderWizardImportsRouter/);
assert.match(routes, /folderWizardRoutingRouter/);
assert.match(panel, /SharePointEnrollmentStatus/);
assert.match(panel, /FolderWizardRoutingPanel/);
console.log("VIVA_BLOCK02_BUILD007=PASS connector=folder_wizard custody=IMMUTABLE publish=CONFIRMED_ONLY");
