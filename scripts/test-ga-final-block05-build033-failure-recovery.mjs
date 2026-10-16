import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const read = (file) => readFileSync(file, "utf8");
const run = (file, ts = false) => {
  const args = ts ? ["artifacts/api-server/node_modules/tsx/dist/cli.mjs", file] : [file];
  const result = spawnSync(process.execPath, args, { encoding: "utf8" });
  assert.equal(result.status, 0, `${file} failed:\n${result.stdout}\n${result.stderr}`);
};

for (const file of [
  "artifacts/api-server/src/lib/ux-failure-journey.behavior.ts",
  "artifacts/api-server/src/lib/block22-build110-security-recovery-acceptance.behavior.ts",
  "artifacts/api-server/src/lib/block18-build090-integration-recovery.behavior.ts",
  "artifacts/bimlog/src/lib/deployment-module-recovery.behavior.ts",
]) run(file, true);
run("artifacts/api-server/src/lib/post-p17-build62-files-upload-storage.behavior.mjs");

const app = read("artifacts/bimlog/src/App.tsx");
const projects = read("artifacts/api-server/src/routes/projects.ts");
const auth = read("artifacts/api-server/src/middlewares/auth.ts");
const files = read("artifacts/bimlog/src/pages/project/FilesTab.tsx");
const reports = read("artifacts/bimlog/src/pages/project/ReportsTab.tsx");
const notifications = read("artifacts/bimlog/src/components/notifications/NotificationPreferenceCenter.tsx");
const integrations = read("artifacts/bimlog/src/pages/project/IntegrationsTab.tsx");
const intake = read("artifacts/bimlog/src/pages/JobIntakeWorkspace.tsx");
const operationalFailure = read("artifacts/api-server/src/lib/operational-failure.ts");
const forecast = read("artifacts/api-server/src/lib/cost-value-forecast-service.ts");
const assistant = read("artifacts/bimlog/src/components/layout/PageAssistant.tsx");
const loading = read("artifacts/bimlog/src/route-loading.behavior.mjs") + read("artifacts/bimlog/src/project-route-loading.behavior.mjs");

const coverage = {
  loading: /aria-live="polite"/.test(loading),
  empty: /No accessible integrations match/.test(integrations),
  invalid_input: /companyCode is required|Either userId or newUserData is required|A valid project is required/.test(projects + forecast),
  duplicate_code: /active project with code[\s\S]*already exists/.test(projects),
  permission_denial: /Insufficient permissions for this action/.test(auth),
  expired_session: /includes\("401"\)[\s\S]*logout\(\)[\s\S]*\/login/.test(app),
  timeout: /timeout/i.test(assistant),
  api_failure: /Failed to load report|Unable to load approved integrations/i.test(reports + integrations),
  upload_failure: /uploadError|upload.*failed|Could not upload/i.test(files),
  export_failure: /report could not be prepared|Could not prepare the Reports Hub PDF/i.test(reports),
  notification_failure: /Could not load notifications|No se pudieron cargar las notificaciones/.test(notifications),
  integration_failure: /catalogLoadFailed|Unable to load approved integrations/.test(integrations),
  partial_save: /newer browser draft is retained separately/.test(intake),
  stale_data: /stale/i.test(intake + forecast),
  cancellation: /AbortController|\.abort\(\)/.test(files + integrations + assistant + reports),
  retry: /retry|Reload|Refresh/i.test(app + integrations + reports),
  refresh_recovery: /refresh|reload/i.test(intake + integrations),
  concurrent_editing: /pg_advisory_xact_lock|expectedVersion|VERSION_CONFLICT/.test(forecast + operationalFailure + intake),
};

assert.deepEqual(Object.entries(coverage).filter(([, passed]) => !passed), [], `failure/recovery coverage missing: ${JSON.stringify(coverage)}`);
assert.doesNotMatch(reports + integrations + files, /res\.send\(error\.stack\)|JSON\.stringify\(error\)/, "browser failure paths must not expose raw exceptions");

console.log(`GA-F05-B033 loading/empty/input/auth/session/timeout/API/upload/export/notification/integration/save/stale/cancel/retry/refresh/concurrency matrix: PASS (${Object.keys(coverage).length}/18)`);
