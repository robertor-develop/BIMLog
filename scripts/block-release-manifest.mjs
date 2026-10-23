import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

export function validateBlockReleaseManifest(receipt) {
  const errors = [];
  const require = (condition, field) => { if (!condition) errors.push(field); };
  require(receipt?.schemaVersion === "bimlog-block-release-manifest-v1", "schemaVersion");
  require(/^[0-9a-f]{40}$/.test(receipt?.source?.commit ?? ""), "source.commit");
  require(/^[0-9a-f]{40}$/.test(receipt?.source?.tree ?? ""), "source.tree");
  require(receipt?.source?.clean === true, "source.clean");
  require(/^[0-9a-f]{64}$/.test(receipt?.migrationSet?.sha256 ?? ""), "migrationSet.sha256");
  require(receipt?.migrationSet?.schemaAction === "NONE" || receipt?.migrationSet?.schemaAction === "ADDITIVE_REVIEW_REQUIRED", "migrationSet.schemaAction");
  require(/^[0-9a-f]{40}$/.test(receipt?.rollback?.targetCommit ?? ""), "rollback.targetCommit");
  require(receipt?.acceptance?.authenticatedChrome === "REQUIRED_AFTER_PUBLICATION", "acceptance.authenticatedChrome");
  require(receipt?.publication?.provider === "Replit", "publication.provider");
  return { ok: errors.length === 0, errors };
}

export function captureBlockReleaseManifest({ block, builds }) {
  const status = git("status", "--porcelain");
  const migrations = git("ls-files", "lib/db", "artifacts/api-server/src/schema").split(/\r?\n/).filter(Boolean).sort();
  const migrationDigest = crypto.createHash("sha256");
  for (const relative of migrations) migrationDigest.update(relative).update("\0").update(fs.readFileSync(path.join(root, relative))).update("\0");
  const receipt = {
    schemaVersion: "bimlog-block-release-manifest-v1",
    capturedAt: new Date().toISOString(),
    block,
    builds,
    source: { commit: git("rev-parse", "HEAD"), tree: git("rev-parse", "HEAD^{tree}"), branch: git("branch", "--show-current"), clean: status === "" },
    migrationSet: { sha256: migrationDigest.digest("hex"), files: migrations.length, schemaAction: "NONE" },
    artifact: { contract: "runtime /api/v1/healthz assetManifestSha256 and packageId must bind this source commit at publication" },
    productionIdentity: { contract: "sourceCommit must equal source.commit and identityBound must be true" },
    rollback: { targetCommit: git("rev-parse", "HEAD^"), schemaAction: "NONE" },
    acceptance: { authenticatedChrome: "REQUIRED_AFTER_PUBLICATION", exactHeadGate: "REQUIRED_BEFORE_PUSH" },
    publication: { provider: "Replit", agentsAllowed: false },
  };
  const validation = validateBlockReleaseManifest(receipt);
  if (!validation.ok) throw new Error(`Block release manifest invalid: ${validation.errors.join(", ")}`);
  return receipt;
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const outputIndex = process.argv.indexOf("--output");
  const blockIndex = process.argv.indexOf("--block");
  const buildsIndex = process.argv.indexOf("--builds");
  if (outputIndex < 0 || blockIndex < 0 || buildsIndex < 0) throw new Error("Use --block <n> --builds <start-end> --output <path>.");
  const receipt = captureBlockReleaseManifest({ block: Number(process.argv[blockIndex + 1]), builds: process.argv[buildsIndex + 1] });
  if (!receipt.source.clean) throw new Error("Exact-head release manifest requires a clean worktree.");
  const output = path.resolve(process.argv[outputIndex + 1]);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const bytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  fs.writeFileSync(output, bytes);
  console.log(JSON.stringify({ status: "PASS", output, sourceCommit: receipt.source.commit, manifestSha256: sha256(bytes) }));
}
