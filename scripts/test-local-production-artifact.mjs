import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiRoot = path.join(root, "artifacts", "api-server");
const result = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/test-production-artifact-closure.ts"], {
  cwd: apiRoot,
  env: {
    ...process.env,
    BIMLOG_ARTIFACT_PROOF_DATABASE_URL: "postgresql://postgres@127.0.0.1:55469/bimlog_rfi_test",
    BIMLOG_ARTIFACT_PROOF_ROOT: "F:\\BIMLog\\TestProof\\artifact-proof-20260924",
  },
  stdio: "inherit",
  windowsHide: true,
});
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`Production artifact closure failed (${result.status}).`);
