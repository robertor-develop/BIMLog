import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

// Read-only recovery census. No checkout, cleanup, migration, package install or secret output.
const roots = [
  "F:/BIMLog/Repositories/bimlog",
  "F:/BIMLog/Repositories/bimlog/.worktrees/commercial-financial-recovery-successor-20260731",
  "F:/BIMLog/Repositories/bimlog/.worktrees/generic-apu-ui-20260805",
];
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const git = (root, ...args) => execFileSync("git", ["-c", `safe.directory=${root}`, "-C", root, ...args], {encoding:"utf8", maxBuffer:16*1024*1024});
const classify = relative => {
  if (/procore-rfi-project26/.test(relative)) return {decision:"PRESERVE_NOT_IMPORT", reason:"Project26-specific dry-run wrapper; reuse current generic procore-rfi-import, never add customer-specific production authority.", compareWith:"artifacts/api-server/src/lib/procore-rfi-import.ts"};
  if (/generic-apu/.test(relative)) return {decision:"PRESERVE_COMPARE_IN_C011_C020", reason:"Unaccepted historical contract/test candidate. Names absent at current HEAD do not prove missing behavior; compare approved versions, snapshots and authority before any recovery.", compareWith:"artifacts/api-server/src/lib/company-pricing-template-contract.ts"};
  if (/FinancialApuWorkspace|ProjectSidebar|apu-project-26|project-26-apu/.test(relative)) return {decision:"PRESERVE_NOT_REPLACE", reason:"Old UI/harness changes cannot replace current APU workspace or sidebar wholesale; current canonical routes remain authoritative.", compareWith:"artifacts/bimlog/src/pages/FinancialApuWorkspace.tsx"};
  if (/database-safety/.test(relative)) return {decision:"PRESERVE_NOT_REPLACE", reason:"Historical safety edits must not overwrite the current database protection implementation.", compareWith:relative};
  return {decision:"PRESERVE_ONLY", reason:"Outside bounded APU/Procore recovery; no mutation or deletion authorized.", compareWith:null};
};
const worktrees = roots.map(root => {
  const names = new Set([
    ...git(root,"diff","--name-only","HEAD","--").trim().split(/\r?\n/),
    ...git(root,"ls-files","--others","--exclude-standard","--","artifacts/api-server/src/lib","artifacts/bimlog/src","artifacts/bimlog/apu-project-26-harness.html").trim().split(/\r?\n/),
  ].filter(Boolean));
  const files = [...names].sort().map(relative => {
    const source = path.join(root,relative);
    const bytes = fs.existsSync(source) ? fs.readFileSync(source) : null;
    const target = path.join(process.cwd(),relative);
    const currentHash = fs.existsSync(target) && fs.statSync(target).isFile() ? sha(fs.readFileSync(target)) : null;
    return {relative, sourceSha256:bytes ? sha(bytes):null, bytes:bytes?.length ?? null, currentSha256:currentHash, identical:bytes !== null && sha(bytes) === currentHash, ...classify(relative)};
  });
  return {root,head:git(root,"rev-parse","HEAD").trim(),sourceMutated:false,files};
});
const result = {schemaVersion:1, scope:"C002 bounded recovery inventory; not a semantic equivalence or restoration claim", deletionAllowed:false, wholesaleMergeAllowed:false, sourceHead:git(process.cwd(),"rev-parse","HEAD").trim(),worktrees};
const output = path.resolve("evidence/coordination-routing-20260925/CONSOLIDATION_C002_RECOVERY.json");
if (process.argv.includes("--write")) fs.writeFileSync(output,JSON.stringify(result,null,2)+"\n");
else {
  const saved=JSON.parse(fs.readFileSync(output,"utf8"));
  if (JSON.stringify(saved.worktrees)!==JSON.stringify(result.worktrees)) throw new Error("Preserved recovery sources changed; inspect differences before recovery");
}
console.log(`C002_RECOVERY=${process.argv.includes("--write")?"RECORDED":"UNCHANGED"} roots=${roots.length} files=${worktrees.reduce((n,w)=>n+w.files.length,0)} deletionAllowed=false`);
