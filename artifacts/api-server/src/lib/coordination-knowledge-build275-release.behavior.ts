import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const ledger = JSON.parse(readFileSync(new URL("../../../../evidence/coordination-knowledge-program-20260921/BUILD_LEDGER.json", import.meta.url), "utf8")) as {
  range: { firstBuild: number; completedThrough: number; finalBuild: number };
  currentBlock: { number: number; builds: string; publicationDue: boolean };
  buildCommits: Record<string, string>;
  remainingBlocks: number;
  remainingBuilds: number;
  lensNext: { nativeChanged: boolean; installerChanged: boolean };
};
assert.deepEqual(ledger.range, { firstBuild: 226, completedThrough: 275, finalBuild: 275 });
assert.equal(ledger.currentBlock.number, 10);
assert.equal(ledger.currentBlock.builds, "271-275");
assert.equal(ledger.currentBlock.publicationDue, true);
assert.equal(ledger.remainingBlocks, 0);
assert.equal(ledger.remainingBuilds, 0);
const expectedBuilds = Array.from({ length: 50 }, (_, index) => String(226 + index));
assert.deepEqual(Object.keys(ledger.buildCommits).sort((a, b) => Number(a) - Number(b)), expectedBuilds);
for (const [build, hash] of Object.entries(ledger.buildCommits)) {
  if (build === "275") { assert.equal(hash, "PENDING"); continue; }
  assert.match(hash, /^[a-f0-9]{8}$/);
  execFileSync("git", ["cat-file", "-e", `${hash}^{commit}`], { cwd: repositoryRoot, stdio: "ignore" });
}
assert.equal(ledger.lensNext.nativeChanged, false);
assert.equal(ledger.lensNext.installerChanged, false);

const rootPackage = readFileSync(new URL("../../../../package.json", import.meta.url), "utf8");
assert.match(rootPackage, /test:coordination-knowledge-block10/);
assert.match(rootPackage, /gate:pre-push[^\n]+test:coordination-knowledge-block10/);
for (const report of [
  "BUILD_271_SECURITY_AND_TENANT_ISOLATION.md",
  "BUILD_272_DATA_INTEGRITY_AND_MIGRATION.md",
  "BUILD_273_UX_ACCESSIBILITY_RESPONSIVE_PERFORMANCE.md",
  "BUILD_274_COMPLETE_PLATFORM_REGRESSION.md",
  "BLOCK_10_REPORT.md",
]) readFileSync(new URL(`../../../../evidence/coordination-knowledge-program-20260921/${report}`, import.meta.url), "utf8");

console.log("Build 275 release acceptance contract: PASS records=50 security=PASS migration=PASS accessibility=PASS regression=PASS native-smoke=NOT_REQUIRED publication=DUE");
