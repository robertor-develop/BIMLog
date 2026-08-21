import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";

const sha = value => createHash("sha256").update(value).digest("hex");
const git = (args, options = {}) => execFileSync("git", args, { encoding: "utf8", ...options });
const need = name => { const value = process.env[name]; if (!value) throw new Error(`${name} is required`); return value; };
const outputRoot = path.resolve(need("BIMLOG_FEEDBACK_INTEGRATED_OUTPUT"));
if (existsSync(outputRoot)) throw new Error(`Collision guard: ${outputRoot} exists`);

const productionRoots = ["artifacts/bimlog/src", "artifacts/bimlog/public", "artifacts/bimlog/index.html", "artifacts/bimlog/package.json", "artifacts/bimlog/vite.config.ts", "artifacts/bimlog/tsconfig.json", "lib/api-client-react", "lib/api-zod", "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "tsconfig.base.json"];
const textExtensions = new Set([".cjs", ".css", ".csv", ".html", ".js", ".json", ".jsx", ".md", ".mjs", ".svg", ".toml", ".ts", ".tsx", ".txt", ".yaml", ".yml"]);
const normalizeText = bytes => Buffer.from(bytes.toString("utf8").replace(/\r\n/g, "\n"));

function snapshot(label) {
  const head = git(["rev-parse", "HEAD"]).trim(), tree = git(["rev-parse", "HEAD^{tree}"]).trim();
  const status = git(["status", "--porcelain=v1", "--untracked-files=all"]).trim();
  if (status) throw new Error(`${label}: complete tracked/untracked worktree is not clean:\n${status}`);
  const paths = git(["ls-tree", "-r", "--name-only", head, "--", ...productionRoots]).split(/\r?\n/).filter(Boolean).sort();
  if (paths.length !== 256) throw new Error(`${label}: expected 256 production inputs, resolved ${paths.length}`);
  const inputs = Object.fromEntries(paths.map(relativePath => {
    const blobId = git(["rev-parse", `${head}:${relativePath}`]).trim();
    const gitBytes = execFileSync("git", ["cat-file", "blob", blobId], { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 });
    const checkoutBytes = readFileSync(path.resolve(relativePath));
    const extension = path.extname(relativePath).toLowerCase(), classification = textExtensions.has(extension) ? "text" : "binary";
    if (classification === "text") {
      if (!normalizeText(gitBytes).equals(normalizeText(checkoutBytes))) throw new Error(`${label}: text checkout mismatch after CRLF normalization: ${relativePath}`);
    } else if (!gitBytes.equals(checkoutBytes)) throw new Error(`${label}: binary checkout differs byte-for-byte from Git blob: ${relativePath}`);
    const text = classification === "text" ? checkoutBytes.toString("utf8") : "";
    const crlf = classification === "text" ? (text.match(/\r\n/g) || []).length : 0, bareLf = classification === "text" ? (text.match(/(?<!\r)\n/g) || []).length : 0;
    return [relativePath, { classification, gitBlobId: blobId, gitBlobSha256: sha(gitBytes), checkoutSha256: sha(checkoutBytes), normalizedSha256: classification === "text" ? sha(normalizeText(checkoutBytes)) : null, bytes: checkoutBytes.length, eol: classification === "binary" ? "not-applicable" : crlf && bareLf ? "mixed" : crlf ? "crlf" : bareLf ? "lf" : "no-newline", comparisonPolicy: classification === "text" ? "CRLF-to-LF normalized equality" : "exact byte equality" }];
  }));
  return { label, capturedAt: new Date().toISOString(), head, tree, status: "clean", productionInputCount: paths.length, inputs };
}

const preflight = snapshot("preflight");
mkdirSync(outputRoot, { recursive: false });
const bundleRoot = path.join(outputRoot, "bundle"), evidenceRoot = path.join(outputRoot, "evidence");
const pnpmPath = execFileSync("where.exe", ["pnpm.cmd"], { encoding: "utf8" }).split(/\r?\n/).find(Boolean);
const vitePath = path.resolve("artifacts/bimlog/node_modules/vite/bin/vite.js");
const buildArgs = [vitePath, "build", "--config", path.resolve("artifacts/bimlog/vite.config.ts"), "--outDir", bundleRoot];
const toolchain = {
  command: { executable: process.execPath, args: buildArgs, cwd: process.cwd() },
  node: { version: process.version, executable: process.execPath, sha256: sha(readFileSync(process.execPath)) },
  pnpm: { path: pnpmPath, sha256: sha(readFileSync(pnpmPath)) },
  vite: { path: vitePath, sha256: sha(readFileSync(vitePath)) },
  locks: Object.fromEntries(["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "artifacts/bimlog/package.json"].map(file => [file, sha(readFileSync(file))])),
};
execFileSync(process.execPath, buildArgs, { cwd: process.cwd(), stdio: "inherit", env: { ...process.env, NODE_ENV: "production" } });
const indexPath = path.join(bundleRoot, "index.html"), assetsPath = path.join(bundleRoot, "assets");
if (!existsSync(indexPath) || !existsSync(assetsPath)) throw new Error("Isolated build verification failed: index/assets absent");
const bundleFiles = readdirSync(assetsPath).sort();
if (!bundleFiles.some(file => file.endsWith(".js")) || !bundleFiles.some(file => file.endsWith(".css"))) throw new Error("Isolated build verification failed: JS/CSS assets absent");
const bundle = Object.fromEntries(bundleFiles.map(file => { const full = path.join(assetsPath, file); return [file, { bytes: statSync(full).size, sha256: sha(readFileSync(full)) }]; }));

const mime = { ".css": "text/css", ".html": "text/html", ".ico": "image/x-icon", ".jpg": "image/jpeg", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
const server = createServer((request, response) => {
  const requested = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
  let file = path.resolve(bundleRoot, `.${requested}`);
  if (!file.startsWith(path.resolve(bundleRoot)) || !existsSync(file) || statSync(file).isDirectory()) file = indexPath;
  response.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }); response.end(readFileSync(file));
});
await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
const address = server.address(), baseUrl = `http://127.0.0.1:${address.port}`;
const browserCommand = { executable: process.execPath, args: [path.resolve("artifacts/bimlog/scripts/feedback-addendum-browser-evidence.mjs")], cwd: process.cwd() };
try {
  await new Promise((resolve, reject) => {
    const child = spawn(browserCommand.executable, browserCommand.args, { cwd: browserCommand.cwd, stdio: "inherit", env: { ...process.env, BIMLOG_FEEDBACK_EVIDENCE_URL: baseUrl, BIMLOG_FEEDBACK_EVIDENCE_OUTPUT: evidenceRoot, BIMLOG_FEEDBACK_BUNDLE_ROOT: bundleRoot } });
    child.once("error", reject); child.once("exit", code => code === 0 ? resolve() : reject(new Error(`Browser harness exited ${code}`)));
  });
} finally { await new Promise(resolve => server.close(resolve)); }

const postflight = snapshot("postflight");
if (preflight.head !== postflight.head || preflight.tree !== postflight.tree || JSON.stringify(preflight.inputs) !== JSON.stringify(postflight.inputs)) throw new Error("Postflight provenance differs from preflight");
const manifestPath = path.join(evidenceRoot, "manifest.json"), manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
manifest.integratedSeal = { schemaVersion: "1.0.0", preflight, build: { startedAfterPreflight: true, isolatedOutput: bundleRoot, toolchain, bundle }, run: { browserCommand, servedOnlyFrom: bundleRoot, baseUrl }, postflight, equality: { head: true, tree: true, status: true, productionInputs: true } };
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`integrated feedback evidence sealed: ${manifestPath}`);
