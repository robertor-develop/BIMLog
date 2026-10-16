import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scenario = process.argv.find((value) => value.startsWith("--scenario="))?.slice(11) ?? "all";
const allowed = new Set(["project", "catalog", "directory", "roles", "intake", "all"]);
if (!allowed.has(scenario)) throw new Error(`Unsupported recovery GA HTTP scenario: ${scenario}`);
function run(args, cwd = root, env = process.env) {
  const result = spawnSync(process.execPath, args, { cwd, env, stdio: "inherit", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Recovery GA HTTP command failed (${result.status}).`);
}
if (process.argv.includes("--prepared")) {
  const target = new URL(process.env.PROD_DATABASE_URL ?? "postgres://invalid/invalid");
  if (target.hostname !== "127.0.0.1" || target.port !== "55449" || target.pathname !== "/bimlog_recovery_ga_http_test")
    throw new Error("Only the disposable local recovery GA HTTP fixture is allowed.");
  run(["node_modules/drizzle-kit/bin.cjs", "push", "--dialect", "postgresql", "--schema", "./src/schema/index.ts", "--url", target.toString()], path.join(root, "lib/db"));
  run(["artifacts/api-server/node_modules/tsx/dist/cli.mjs", "artifacts/api-server/src/lib/recovery-ga-authenticated-http.ts", `--scenario=${scenario}`]);
} else {
  run(["scripts/workflow-database-fixture.mjs", "--run", "bimlog_recovery_ga_http_test", "--", process.execPath, "scripts/test-recovery-ga-http.mjs", "--prepared", `--scenario=${scenario}`], root,
    { ...process.env, BIMLOG_WORKFLOW_FIXTURE_ADMIN_URL: "postgresql://postgres@127.0.0.1:55449/postgres", NODE_ENV: "test" });
  console.log(`RECOVERY_GA_AUTHENTICATED_HTTP=PASS scenario=${scenario} production_mutations=0`);
}
