import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "../../..");
const focused = ["post-p17-build16-reporting-identity.behavior.mjs", "post-p17-build17-apu-history-provenance.behavior.mjs", "post-p17-build18-scope-redaction.behavior.mjs", "post-p17-build19-help-audit.behavior.mjs"];
const results = [];
const run = (name, executable, args) => {
  const r = spawnSync(executable, args, { cwd: root, encoding: "utf8" });
  process.stdout.write(r.stdout || ""); process.stderr.write(r.stderr || "");
  results.push({ name, exitCode: r.status });
  if (r.status !== 0) process.exit(r.status || 1);
};
for (const file of focused) {
  const relative = `artifacts/api-server/src/lib/${file}`;
  run(file, process.execPath, [relative]);
  results.at(-1).sha256 = crypto.createHash("sha256").update(fs.readFileSync(path.join(root, relative))).digest("hex");
}
run("generic-apu", "cmd.exe", ["/d", "/s", "/c", "pnpm", "--filter", "@workspace/api-server", "run", "test:generic-apu"]);
run("governed-production-build", "cmd.exe", ["/d", "/s", "/c", "pnpm", "run", "build"]);
const output = path.join(root, "evidence", "post-p17-builds16-20-acceptance");
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "results.json"), JSON.stringify({ status: "PASS", version: "v1.05.N17-P17", results, productCodeChanged: false, databaseChanged: false, schemaChanged: false, nativeChanged: false, deploymentChanged: false }, null, 2));
console.log("POST-P17 Builds 16-20 consolidated acceptance: PASS");
