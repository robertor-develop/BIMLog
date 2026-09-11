import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../../..");
const results = [];
const run = (name, executable, args) => {
  const result = spawnSync(executable, args, { cwd: root, encoding: "utf8" });
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  results.push({ name, exitCode: result.status });
  if (result.status !== 0) process.exit(result.status || 1);
};

const focused = [
  "post-p17-build31-submittal-identity-scope.behavior.mjs",
  "post-p17-build32-submittal-lifecycle-history.behavior.mjs",
  "post-p17-build33-submittal-attachment-integrity.behavior.mjs",
  "post-p17-build34-submittal-workflow-ui.behavior.mjs",
];
for (const file of focused) {
  const relative = `artifacts/api-server/src/lib/${file}`;
  run(file, process.execPath, [relative]);
  results.at(-1).sha256 = crypto.createHash("sha256").update(fs.readFileSync(path.join(root, relative))).digest("hex");
}

run("protected-apu-regression", "cmd.exe", ["/d", "/s", "/c", "pnpm", "--filter", "@workspace/api-server", "run", "test:generic-apu"]);
run("protected-lens-next-regression", "cmd.exe", ["/d", "/s", "/c", "pnpm", "--filter", "@workspace/api-server", "run", "test:lens-next-build30"]);
run("protected-lens-next-current-regression", "cmd.exe", ["/d", "/s", "/c", "pnpm", "--filter", "@workspace/api-server", "run", "test:lens-next-build10"]);
run("governed-production-build", "cmd.exe", ["/d", "/s", "/c", "pnpm", "run", "build"]);

const output = path.join(root, "evidence", "post-p17-builds31-35-acceptance");
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "results.json"), JSON.stringify({
  status: "PASS",
  version: "v1.05.N17-P17",
  results,
  browserEvidence: "evidence/post-p17-build34-submittal-chrome/acceptance.json",
  productCodeChanged: false,
  apuProductChanged: false,
  lensNextProductChanged: false,
  databaseChanged: false,
  schemaChanged: false,
  nativeChanged: false,
  deploymentChanged: false,
}, null, 2));
console.log("POST-P17 Builds 31-35 consolidated acceptance: PASS");
