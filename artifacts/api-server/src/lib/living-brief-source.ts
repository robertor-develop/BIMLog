import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

export type LivingBriefCatalogEntry = {
  key: string;
  file: string;
  label: { en: string; es: string };
  scope: string;
};

export type LivingBriefManifestDocument = {
  key: string;
  file: string;
  sha256: string;
  sourceChangedAt: string;
  changeState: "accepted" | "candidate";
  reconciledThroughCommit: string;
  semanticReviewedThroughCommit: string;
  semanticReviewTask: string;
  semanticReviewResult: "updated" | "reviewed_no_semantic_change";
  semanticReviewedAt: string;
};

export type LivingBriefManifest = {
  schemaVersion: number;
  reconciledThroughCommit: string;
  catalogSha256: string;
  bundleSha256: string;
  documents: LivingBriefManifestDocument[];
};

export type LivingBriefSourceDocument = LivingBriefCatalogEntry &
  LivingBriefManifestDocument & { content: string };

export type LivingBriefSourceBundle = {
  directory: string;
  catalog: LivingBriefCatalogEntry[];
  manifest: LivingBriefManifest;
  documents: LivingBriefSourceDocument[];
};

function moduleDirectory(): string | null {
  try {
    // @ts-ignore __dirname exists in the CommonJS production bundle.
    if (typeof __dirname !== "undefined") return __dirname as string;
  } catch { /* ESM runtime */ }
  try {
    if (import.meta.url) return path.dirname(fileURLToPath(import.meta.url));
  } catch { /* CommonJS runtime */ }
  return null;
}

export function findLivingBriefDirectory(): string {
  const explicit = process.env.BIMLOG_LIVING_BRIEF_SOURCE_DIR;
  if (explicit) {
    if (process.env.NODE_ENV === "production") throw new Error("Living Brief source override is disabled in production");
    const resolved = path.resolve(explicit);
    if (fs.existsSync(path.join(resolved, "catalog.json")) && fs.existsSync(path.join(resolved, "state.json"))) return resolved;
    throw new Error("Configured Living Brief source bundle is incomplete");
  }
  const starts = [process.cwd(), moduleDirectory()].filter((value): value is string => !!value);
  for (const start of starts) {
    let current = path.resolve(start);
    for (let depth = 0; depth < 9; depth += 1) {
      const candidate = path.join(current, "living-brief");
      if (fs.existsSync(path.join(candidate, "catalog.json")) && fs.existsSync(path.join(candidate, "state.json"))) {
        return candidate;
      }
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  throw new Error("Verified Living Brief source bundle was not found");
}

export function sha256(value: string | Buffer): string {
  return crypto.createHash("sha256").update(canonicalLivingBriefText(value)).digest("hex");
}

export function canonicalLivingBriefText(value: string | Buffer): string {
  return (Buffer.isBuffer(value) ? value.toString("utf8") : value).replace(/\r\n?/g, "\n");
}

function gitRoot(directory: string): string | null {
  try {
    return execFileSync("git", ["-C", path.dirname(directory), "rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

function assertCommitClaim(commit: string, label: string, directory: string, ancestor?: string): void {
  if (!/^[0-9a-f]{40}$/i.test(commit)) throw new Error(`${label} must be a full 40-character Git commit`);
  const root = gitRoot(directory);
  if (!root) return;
  try {
    execFileSync("git", ["-C", root, "cat-file", "-e", `${commit}^{commit}`], { stdio: "ignore" });
    if (ancestor) execFileSync("git", ["-C", root, "merge-base", "--is-ancestor", ancestor, commit], { stdio: "ignore" });
    const changedAt = execFileSync("git", ["-C", root, "show", "-s", "--format=%cI", commit], { encoding: "utf8" }).trim();
    if (Date.parse(changedAt) > Date.now() + 5 * 60_000) throw new Error(`${label} has a future commit time`);
  } catch (error) {
    if (error instanceof Error && error.message.includes("future commit time")) throw error;
    throw new Error(`${label} is invalid or is not a descendant of the reconciled-through commit`);
  }
}

export function livingBriefSourceIdentity(source: LivingBriefSourceBundle): string {
  return [source.manifest.catalogSha256, source.manifest.bundleSha256, source.manifest.reconciledThroughCommit].join(":");
}

export function loadLivingBriefSource(): LivingBriefSourceBundle {
  const directory = findLivingBriefDirectory();
  const catalogBytes = fs.readFileSync(path.join(directory, "catalog.json"));
  const catalogFile = JSON.parse(catalogBytes.toString("utf8")) as { schemaVersion: number; documents: LivingBriefCatalogEntry[] };
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, "state.json"), "utf8")) as LivingBriefManifest;
  if (catalogFile.schemaVersion !== 1 || manifest.schemaVersion !== 1) throw new Error("Unsupported Living Brief metadata schema");
  if (sha256(catalogBytes) !== manifest.catalogSha256) throw new Error("Living Brief catalog hash does not match state.json");
  assertCommitClaim(manifest.reconciledThroughCommit, "Living Brief reconciled-through commit", directory);
  const metadataByKey = new Map(manifest.documents.map((document) => [document.key, document]));
  const documents = catalogFile.documents.map((entry) => {
    const metadata = metadataByKey.get(entry.key);
    if (!metadata || metadata.file !== entry.file) throw new Error(`Living Brief metadata missing for ${entry.key}`);
    if (metadata.reconciledThroughCommit !== manifest.reconciledThroughCommit) throw new Error(`Living Brief stale reconciled-through marker for ${entry.file}`);
    if (metadata.semanticReviewedThroughCommit !== manifest.reconciledThroughCommit) throw new Error(`Living Brief stale semantic review for ${entry.file}`);
    if (!metadata.semanticReviewTask || !["updated", "reviewed_no_semantic_change"].includes(metadata.semanticReviewResult)) throw new Error(`Living Brief semantic review metadata is invalid for ${entry.file}`);
    if (!Number.isFinite(Date.parse(metadata.semanticReviewedAt)) || Date.parse(metadata.semanticReviewedAt) > Date.now() + 5 * 60_000) throw new Error(`Living Brief future semantic-review claim for ${entry.file}`);
    if (Date.parse(metadata.sourceChangedAt) > Date.now() + 5 * 60_000) throw new Error(`Living Brief future source-change claim for ${entry.file}`);
    const content = canonicalLivingBriefText(fs.readFileSync(path.join(directory, entry.file)));
    if (sha256(content) !== metadata.sha256) throw new Error(`Living Brief source hash mismatch for ${entry.file}`);
    return { ...entry, ...metadata, content };
  });
  if (documents.length !== manifest.documents.length) throw new Error("Living Brief catalog and manifest document counts differ");
  return { directory, catalog: catalogFile.documents, manifest, documents };
}

export function resolveDeployedSourceCommit(manifest: LivingBriefManifest, directory = findLivingBriefDirectory()): string {
  const provided = process.env.BIMLOG_SOURCE_COMMIT || process.env.REPLIT_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA;
  if (provided) {
    assertCommitClaim(provided, "BIMLOG_SOURCE_COMMIT", directory, manifest.reconciledThroughCommit);
    return provided.toLowerCase();
  }
  try {
    const commit = execFileSync("git", ["-C", path.dirname(directory), "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    if (/^[0-9a-f]{40}$/i.test(commit)) {
      assertCommitClaim(commit, "deployed source commit", directory, manifest.reconciledThroughCommit);
      return commit.toLowerCase();
    }
  } catch { /* Production bundles may intentionally omit .git. */ }
  if (process.env.REPLIT_DEPLOYMENT === "1" || process.env.NODE_ENV === "production") {
    throw new Error("BIMLOG_SOURCE_COMMIT is required when deployed source has no .git metadata");
  }
  return manifest.reconciledThroughCommit;
}
