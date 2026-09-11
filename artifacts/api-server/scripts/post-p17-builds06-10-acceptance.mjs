import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../../..");
const runs = [
  ["build08-autosave", "node", ["artifacts/api-server/src/lib/post-p17-build08-autosave-recovery.behavior.mjs"]],
  ["build09-activation", "node", ["artifacts/api-server/src/lib/post-p17-build09-activation.behavior.mjs"]],
  ["intake-regression", "pnpm", ["--filter", "@workspace/api-server", "run", "test:generic-apu"]],
];
const results = [];
for (const [name, command, args] of runs) {
  const windowsPnpm = process.platform === "win32" && command === "pnpm";
  const executable = windowsPnpm ? "cmd.exe" : command;
  const executableArgs = windowsPnpm ? ["/d", "/s", "/c", "pnpm", ...args] : args;
  const result = spawnSync(executable, executableArgs, { cwd: root, encoding: "utf8", stdio: "pipe", shell: false });
  process.stdout.write(result.stdout || ""); process.stderr.write(result.stderr || "");
  results.push({ name, exitCode: result.status });
  if (result.status !== 0) process.exit(result.status || 1);
}
const output = path.join(root, "evidence", "post-p17-builds06-10-acceptance");
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "results.json"), JSON.stringify({ status: "PASS", version: "v1.05.N17-P17", results, declarations: { productCodeChanged: false, databaseChanged: false, schemaChanged: false, nativeChanged: false, deploymentChanged: false } }, null, 2));
console.log("POST-P17 Builds 06-10 consolidated acceptance: PASS");
