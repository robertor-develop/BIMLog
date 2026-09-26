import { spawnSync } from "node:child_process";
const commands = [
  ["artifacts/api-server/node_modules/tsx/dist/cli.mjs", "artifacts/api-server/scripts/test-workflow-governance-roles.ts"],
  ["scripts/workflow-database-fixture.mjs", "--run", "delivery_runtime_test", "--", process.execPath,
    "artifacts/api-server/node_modules/tsx/dist/cli.mjs", "artifacts/api-server/src/lib/delivery-workflow-runtime.http-evidence.ts"],
];
for (const args of commands) {
  const result = spawnSync(process.execPath,args,{stdio:"inherit",windowsHide:true,env:{...process.env,
    BIMLOG_WORKFLOW_FIXTURE_ADMIN_URL:"postgresql://postgres@127.0.0.1:55449/postgres"}});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("GOVERNANCE_RUNTIME_REGRESSION=PASS real_postgresql=true deployed_acceptance=false");
