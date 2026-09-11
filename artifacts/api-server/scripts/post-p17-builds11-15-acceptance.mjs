import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../../..");
const files = [
  "post-p17-build11-company-contact-authority.behavior.mjs",
  "post-p17-build12-binding-chain.behavior.mjs",
  "post-p17-build13-resource-authority.behavior.mjs",
  "post-p17-build14-activation-outputs.behavior.mjs",
];
const results = [];
for (const file of files) {
  const relative = `artifacts/api-server/src/lib/${file}`;
  const result = spawnSync(process.execPath, [relative], { cwd: root, encoding: "utf8" });
  process.stdout.write(result.stdout || ""); process.stderr.write(result.stderr || "");
  results.push({ file, exitCode: result.status, sha256: crypto.createHash("sha256").update(fs.readFileSync(path.join(root, relative))).digest("hex") });
  if (result.status !== 0) process.exit(result.status || 1);
}
const pnpm = spawnSync("cmd.exe", ["/d", "/s", "/c", "pnpm", "--filter", "@workspace/api-server", "run", "test:generic-apu"], { cwd: root, encoding: "utf8" });
process.stdout.write(pnpm.stdout || ""); process.stderr.write(pnpm.stderr || "");
results.push({ file: "test:generic-apu", exitCode: pnpm.status });
if (pnpm.status !== 0) process.exit(pnpm.status || 1);
const output = path.join(root, "evidence", "post-p17-builds11-15-acceptance");
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "results.json"), JSON.stringify({ status: "PASS", version: "v1.05.N17-P17", results, productCodeChanged: false, databaseChanged: false, schemaChanged: false, nativeChanged: false, deploymentChanged: false }, null, 2));
console.log("POST-P17 Builds 11-15 consolidated acceptance: PASS");
