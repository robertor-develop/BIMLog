import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const command = process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "pnpm";
const args = process.platform === "win32"
  ? ["/d", "/s", "/c", "pnpm --filter @workspace/api-server run test:coordination-knowledge-block10"]
  : ["--filter", "@workspace/api-server", "run", "test:coordination-knowledge-block10"];
const result = spawnSync(command, args, {
  cwd: root,
  env: { ...process.env, BIMLOG_COORDINATION_KNOWLEDGE_TEST_DATABASE_URL: "postgresql://postgres@127.0.0.1:55469/bimlog_rfi_test" },
  stdio: "inherit",
  windowsHide: true,
});
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`Coordination Knowledge fixture failed (${result.status}).`);
console.log("COORDINATION_KNOWLEDGE_BLOCK10=PASS real_postgresql=true deployed_acceptance=false");
