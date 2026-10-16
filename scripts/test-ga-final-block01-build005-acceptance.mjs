import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const receiptPath = "evidence/ga-final-20261015/BLOCK01_AGENT_ACCESS_ACCEPTANCE.json";
const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

assert.equal(receipt.block, "01");
assert.equal(receipt.buildCount, 5);
assert.equal(receipt.builds.length, 5);
assert.equal(new Set(receipt.builds.map((build) => build.id)).size, 5);
assert.deepEqual(receipt.authenticatedRolesCovered, ["super_admin", "company_admin", "project_admin", "coordinator", "member", "viewer"]);
assert.equal(receipt.productionEvidence.answer, "BIMLog Headquarters");
assert.equal(receipt.productionEvidence.persistenceAfterReload, true);
assert.equal(receipt.productionEvidence.staleErrorAfterAnswer, false);
assert.equal(receipt.publicationCadence.unpublishedBuildsAfterBlock, 5);
assert.equal(receipt.publicationCadence.publishAtBuildCount, 10);
for (let number = 1; number <= 5; number += 1) {
  const id = String(number).padStart(3, "0");
  assert.ok(pkg.scripts[`test:ga-final-block01-build${id}`], `missing package gate for build ${id}`);
}
for (const file of [
  "scripts/test-ga-final-block01-build001-agent-access.mjs",
  "scripts/test-ga-final-block01-build002-agent-isolation.mjs",
  "scripts/test-ga-final-block01-build003-desktop-agent.mjs",
  "scripts/test-ga-final-block01-build004-responsive-agent.mjs",
  "scripts/test-ga-final-block01-build005-acceptance.mjs"
]) assert.ok(existsSync(file), `missing acceptance gate ${file}`);

console.log("GA-F01-B005 consolidated acceptance receipt: PASS builds=5 unpublished=5");
