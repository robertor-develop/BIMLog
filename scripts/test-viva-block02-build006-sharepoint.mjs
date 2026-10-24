import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const run = spawnSync("pnpm run test:consolidation-block20", { encoding: "utf8", shell: true });
assert.equal(run.status, 0, `${run.stdout ?? ""}\n${run.stderr ?? run.error ?? ""}`);
const panel = readFileSync("artifacts/bimlog/src/pages/project/SharePointEnrollmentStatus.tsx", "utf8");
const api = readFileSync("artifacts/api-server/src/routes/coordination-hub.ts", "utf8");
assert.match(panel, /connection-health/);
assert.match(panel, /credential-lifecycle/);
assert.match(api, /SharePointCredentialValidator/);
assert.match(api, /requireProjectMember\("project_admin"\)/);
assert.doesNotMatch(panel, /clientSecret|accessToken/);
console.log("VIVA_BLOCK02_BUILD006=PASS connector=sharepoint provider_round_trip=EXTERNAL_WHEN_UNCONFIGURED");
