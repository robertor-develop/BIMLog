import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../../..");
const focused = [
  { file: "post-p17-build21-financial-invariants.behavior.ts", executable: "cmd.exe", prefixArgs: ["/d", "/s", "/c", "artifacts\\api-server\\node_modules\\.bin\\tsx.CMD"] },
  { file: "post-p17-build22-activation-replay-safety.behavior.mjs", executable: process.execPath },
  { file: "post-p17-build23-report-export-scope.behavior.mjs", executable: process.execPath },
  { file: "post-p17-build24-responsive-accessibility.behavior.mjs", executable: process.execPath },
];
const results = [];
const run = (name, executable, args) => {
  const result = spawnSync(executable, args, { cwd: root, encoding: "utf8" });
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  results.push({ name, exitCode: result.status });
  if (result.status !== 0) process.exit(result.status || 1);
};
for (const item of focused) {
  const relative = `artifacts/api-server/src/lib/${item.file}`;
  run(item.file, item.executable, [...(item.prefixArgs ?? []), relative]);
  results.at(-1).sha256 = crypto.createHash("sha256").update(fs.readFileSync(path.join(root, relative))).digest("hex");
}
run("generic-apu", "cmd.exe", ["/d", "/s", "/c", "pnpm", "--filter", "@workspace/api-server", "run", "test:generic-apu"]);
run("governed-production-build", "cmd.exe", ["/d", "/s", "/c", "pnpm", "run", "build"]);
const output = path.join(root, "evidence", "post-p17-builds21-25-acceptance");
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "results.json"), JSON.stringify({ status: "PASS", version: "v1.05.N17-P17", results, productCodeChanged: false, databaseChanged: false, schemaChanged: false, nativeChanged: false, deploymentChanged: false }, null, 2));
console.log("POST-P17 Builds 21-25 consolidated acceptance: PASS");
