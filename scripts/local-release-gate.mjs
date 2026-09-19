import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputIndex = process.argv.indexOf("--output");
if (outputIndex < 0 || !process.argv[outputIndex + 1]) throw new Error("Use --output <external receipt path>.");
const output = path.resolve(process.argv[outputIndex + 1]);
const git = (...args) => execFileSync("git", ["-c", `safe.directory=${root.replaceAll('\\', '/')}`, "-C", root, ...args], { encoding: "utf8" }).trim();
if (git("status", "--porcelain")) throw new Error("Local release gate requires a clean candidate.");

const commands = [
  { id: "proof-roots", command: process.execPath, args: ["scripts/test-proof-root.mjs"] },
  { id: "workflow-database-fixture", command: process.execPath, args: ["scripts/test-workflow-database-fixture.mjs"] },
  { id: "platform-audit-policy", command: process.execPath, args: ["scripts/test-platform-audit-policy.mjs"] },
  { id: "pre-push", command: process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "pnpm", args: process.platform === "win32" ? ["/d", "/s", "/c", "pnpm run gate:pre-push"] : ["run", "gate:pre-push"] },
];
if (new Set(commands.map(command => command.id)).size !== commands.length) throw new Error("Local release gate contains a duplicate command.");

const results = [];
for (const item of commands) {
  const startedAt = Date.now();
  const result = spawnSync(item.command, item.args, { cwd: root, env: process.env, encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  results.push({ id: item.id, exitCode: result.status, elapsedMs: Date.now() - startedAt });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Local release gate failed at ${item.id} with exit ${result.status}.`);
}

const payload = {
  schemaVersion: 1,
  status: "PASS",
  source: { commit: git("rev-parse", "HEAD"), tree: git("rev-parse", "HEAD^{tree}") },
  commandCount: commands.length,
  exactlyOnce: true,
  results,
};
const receipt = { ...payload, receiptSha256: createHash("sha256").update(JSON.stringify(payload)).digest("hex") };
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx" });
console.log(`LOCAL_RELEASE_GATE=PASS commit=${receipt.source.commit} receipt=${receipt.receiptSha256}`);
