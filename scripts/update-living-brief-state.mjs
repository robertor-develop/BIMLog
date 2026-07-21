import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const briefRoot = path.join(root, "living-brief");
const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index], process.argv[index + 1]);
const reconciledThroughCommit = args.get("--reconciled-through");
const candidateChangedAt = args.get("--candidate-changed-at");
if (!reconciledThroughCommit || !/^[0-9a-f]{40}$/i.test(reconciledThroughCommit)) {
  throw new Error("Use --reconciled-through with the full accepted integration commit");
}
if (!candidateChangedAt || Number.isNaN(Date.parse(candidateChangedAt))) {
  throw new Error("Use --candidate-changed-at with the fixed candidate authoring time in ISO-8601 form");
}

function git(...gitArgs) {
  return execFileSync("git", gitArgs, { cwd: root, encoding: "utf8" }).trim();
}
function canonicalText(value) {
  return (Buffer.isBuffer(value) ? value.toString("utf8") : value).replace(/\r\n?/g, "\n");
}
function sha256Text(value) {
  return crypto.createHash("sha256").update(canonicalText(value)).digest("hex");
}
function reviewedChangeDigest(paths) {
  const excluded = new Set(["living-brief/state.json", "living-brief/impact-declarations.json"]);
  return crypto.createHash("sha256").update(paths.filter((value) => !excluded.has(value)).sort().map((relativePath) => {
    const absolutePath = path.join(root, relativePath);
    return `${relativePath}:${fs.existsSync(absolutePath) ? sha256Text(fs.readFileSync(absolutePath)) : "DELETED"}`;
  }).join("\n")).digest("hex");
}
git("cat-file", "-e", `${reconciledThroughCommit}^{commit}`);
const catalogBytes = fs.readFileSync(path.join(briefRoot, "catalog.json"));
const catalog = JSON.parse(catalogBytes.toString("utf8"));
const impactDeclarations = JSON.parse(fs.readFileSync(path.join(briefRoot, "impact-declarations.json"), "utf8"));
const semanticReview = impactDeclarations.reviews?.at(-1);
if (!semanticReview || semanticReview.reviewedThroughCommit !== reconciledThroughCommit) {
  throw new Error("The latest semantic review must cover the reconciled-through commit");
}
const authorityReviews = new Map(semanticReview.authorities.map((entry) => [entry.key, entry]));
const changedPaths = git("diff", "--name-only", reconciledThroughCommit, "--", ".")
  .split(/\r?\n/).filter(Boolean).map((value) => value.replaceAll("\\", "/"))
  .filter((value) => value !== "living-brief/state.json").sort();
const changedSet = new Set(changedPaths);
semanticReview.reviewedChangedPaths = changedPaths;
semanticReview.reviewedChangeSha256 = reviewedChangeDigest(changedPaths);
fs.writeFileSync(path.join(briefRoot, "impact-declarations.json"), `${JSON.stringify(impactDeclarations, null, 2)}\n`, "utf8");
const documents = catalog.documents.map((entry) => {
  const relativePath = `living-brief/${entry.file}`;
  const content = fs.readFileSync(path.join(briefRoot, entry.file));
  const changed = changedSet.has(relativePath);
  const authorityReview = authorityReviews.get(entry.key);
  if (!authorityReview) throw new Error(`Semantic review missing catalog authority ${entry.key}`);
  const sourceChangedAt = changed
    ? new Date(candidateChangedAt).toISOString()
    : git("log", "-1", "--format=%cI", reconciledThroughCommit, "--", relativePath);
  return {
    key: entry.key,
    file: entry.file,
    sha256: sha256Text(content),
    sourceChangedAt,
    changeState: changed ? "candidate" : "accepted",
    reconciledThroughCommit,
    semanticReviewedThroughCommit: semanticReview.reviewedThroughCommit,
    semanticReviewTask: semanticReview.taskId,
    semanticReviewResult: authorityReview.result,
    semanticReviewedAt: semanticReview.reviewedAt,
  };
});
const affected = new Set(["STATUS.md", "OPEN_LOOP.md"]);
for (const changedPath of changedPaths) {
  for (const rule of catalog.impactRules ?? []) {
    if (new RegExp(rule.pattern).test(changedPath)) for (const document of rule.documents) affected.add(document);
  }
}
const bundleSha256 = crypto.createHash("sha256")
  .update(documents.map((document) => `${document.key}:${document.sha256}`).join("\n"))
  .digest("hex");
const state = {
  schemaVersion: 1,
  reconciledThroughCommit,
  catalogSha256: sha256Text(catalogBytes),
  bundleSha256,
  impact: { baselineCommit: reconciledThroughCommit, changedPaths, affectedDocuments: [...affected].sort() },
  documents,
};
fs.writeFileSync(path.join(briefRoot, "state.json"), `${JSON.stringify(state, null, 2)}\n`, "utf8");
console.log(`Updated living-brief/state.json for ${documents.length} documents; narrative documents were not modified.`);
