import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(process.cwd(), "../..");
const api = path.join(repo, "artifacts/api-server");
const outputDir = path.join(repo, "evidence/post-p17-builds01-05-assurance");
const browserEnv = {
  ...process.env,
  BIMLOG_PLAYWRIGHT_CORE: process.env.BIMLOG_PLAYWRIGHT_CORE || "F:/IgniteSmart/Customers/LuxManifest/Repositories/manifest-me-ai/node_modules/playwright-core/index.js",
  BIMLOG_CHROMIUM_EXECUTABLE: process.env.BIMLOG_CHROMIUM_EXECUTABLE || "C:/Users/soporte/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe",
  BIMLOG_JOB_INTAKE_URL: process.env.BIMLOG_JOB_INTAKE_URL || "http://127.0.0.1:4183/job-intake-assurance-harness.html",
};

const run = (name, command, args, cwd, env = process.env) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { cwd, env, windowsHide: true, shell: process.platform === "win32" });
  let stdout = "", stderr = "";
  child.stdout?.on("data", (chunk) => { stdout += chunk; process.stdout.write(chunk); });
  child.stderr?.on("data", (chunk) => { stderr += chunk; process.stderr.write(chunk); });
  child.once("error", reject);
  child.once("exit", (code) => code === 0 ? resolve({ name, status: "PASS", stdout }) : reject(new Error(`${name} failed (${code})\n${stderr}`)));
});

const waitForHarness = async () => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { if ((await fetch(browserEnv.BIMLOG_JOB_INTAKE_URL)).ok) return; } catch { /* retry */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Job Intake browser harness did not become ready.");
};

fs.mkdirSync(outputDir, { recursive: true });
const results = [];
let vite;
try {
  try { await waitForHarness(); }
  catch {
    vite = spawn("pnpm.cmd", ["--filter", "@workspace/bimlog", "run", "dev"], { cwd: repo, env: { ...process.env, PORT: "4183" }, windowsHide: true, shell: process.platform === "win32" });
    await waitForHarness();
  }
  results.push(await run("BUILD01_EXACT_WORKBOOK", ".\\node_modules\\.bin\\tsx.cmd", ["src/lib/post-p17-apu-workbook-acceptance.behavior.ts"], api));
  results.push(await run("BUILD02_PRODUCTION_COMPONENT_BROWSER", "node", ["../bimlog/scripts/post-p17-job-intake-browser-evidence.mjs"], api, browserEnv));
  results.push(await run("BUILD03_PERSISTENCE_BROWSER", "node", ["../bimlog/scripts/post-p17-job-intake-persistence-browser-evidence.mjs"], api, browserEnv));
  results.push(await run("BUILD04_FILE_INSPECTION", ".\\node_modules\\.bin\\tsx.cmd", ["src/lib/post-p17-intake-file-inspection.behavior.ts"], api));
  results.push(await run("WORKSPACE_LIBRARY_TYPECHECK", "pnpm.cmd", ["run", "typecheck:libs"], repo));
  results.push(await run("GENERIC_APU_REGRESSION", "pnpm.cmd", ["--filter", "@workspace/api-server", "run", "test:generic-apu"], repo));
} finally {
  if (vite) vite.kill();
}

const git = (args) => new Promise((resolve, reject) => {
  const child = spawn("git", args, { cwd: repo, windowsHide: true }); let text = "";
  child.stdout.on("data", (chunk) => { text += chunk; }); child.once("error", reject);
  child.once("exit", (code) => code === 0 ? resolve(text.trim()) : reject(new Error(`git ${args.join(" ")} failed`)));
});
const evidenceFiles = [
  "evidence/build20/BIMLog_Smoke_Test_Project_Intake_APUs_BUILD20_FINAL.xlsx",
  "artifacts/api-server/evidence/post-p17-build02-job-intake-browser/results.json",
  "artifacts/api-server/evidence/post-p17-build03-job-intake-persistence/results.json",
].map((relativePath) => {
  const bytes = fs.readFileSync(path.join(repo, relativePath));
  return { path: relativePath.replaceAll("\\", "/"), bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex").toUpperCase() };
});
const manifest = {
  schema: "bimlog.post-p17-assurance.v1",
  release: "v1.05.N17-P17",
  sourceCommit: await git(["rev-parse", "HEAD"]),
  generatedAt: new Date().toISOString(),
  productBehaviorChanged: false,
  databaseChanged: false,
  schemaChanged: false,
  nativeChanged: false,
  deploymentChanged: false,
  results: results.map(({ name, status }) => ({ name, status })),
  evidenceFiles,
  overall: results.every(({ status }) => status === "PASS") ? "PASS" : "FAIL",
};
fs.writeFileSync(path.join(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest, null, 2));
if (manifest.overall !== "PASS") process.exitCode = 1;
