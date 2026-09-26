import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function run(args, cwd = root, env = process.env) {
  const result = spawnSync(process.execPath, args, {cwd, env, stdio:"inherit", windowsHide:true});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Intake fixture command failed (${result.status}).`);
}
if (process.argv.includes("--prepared")) {
  const target = new URL(process.env.PROD_DATABASE_URL ?? "postgres://invalid/invalid");
  if (target.hostname !== "127.0.0.1" || target.port !== "55449" || target.pathname !== "/bimlog_intake_integration_test")
    throw new Error("Only the disposable local Intake fixture is allowed.");
  run(["node_modules/drizzle-kit/bin.cjs","push","--dialect","postgresql","--schema","./src/schema/index.ts","--url",target.toString()], path.join(root,"lib/db"));
  run(["artifacts/api-server/node_modules/tsx/dist/cli.mjs","artifacts/api-server/src/lib/job-intake-pricing-multicontract.http-evidence.ts"]);
} else {
  run(["scripts/workflow-database-fixture.mjs","--run","bimlog_intake_integration_test","--",process.execPath,"scripts/test-intake-activation.mjs","--prepared"],root,
    {...process.env,BIMLOG_WORKFLOW_FIXTURE_ADMIN_URL:"postgresql://postgres@127.0.0.1:55449/postgres"});
  console.log("INTAKE_ACTIVATION=PASS real_postgresql=true deployed_acceptance=false");
}
