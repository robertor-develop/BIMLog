import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const evidencePath = "evidence/ga-final-closure-20261024/build71-release-lineage.json";
const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const hashDirectory = (root) => {
  const files = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = `${dir}/${entry.name}`;
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile()) files.push(file.replaceAll("\\", "/"));
    }
  };
  visit(root);
  files.sort();
  const hash = crypto.createHash("sha256");
  for (const file of files) {
    const relative = file.slice(root.length + 1);
    hash.update(relative).update("\0").update(fs.readFileSync(file)).update("\0");
  }
  return hash.digest("hex");
};

assert.equal(evidence.schemaVersion, "bimlog-ga-build71-release-lineage-v1");
assert.equal(evidence.build, 71);
assert.equal(evidence.reconciledBase.commit, "2a2ab55b0e2ef7ff35ddeac5176f7c6b8d8a39ea");
assert.doesNotThrow(() => git("merge-base", "--is-ancestor", evidence.reconciledBase.commit, "HEAD"));
assert.doesNotThrow(() => git("merge-base", "--is-ancestor", evidence.authoritativeRefs.main, "HEAD"));
assert.doesNotThrow(() => git("merge-base", "--is-ancestor", evidence.authoritativeRefs.master, "HEAD"));
assert.equal(git("rev-parse", "origin/codex/bimlog-template-gap-block01-20260923"), evidence.reconciledBase.commit);
assert.equal(sha256("package.json"), evidence.identities.packageJsonSha256);
assert.equal(sha256("pnpm-lock.yaml"), evidence.identities.lockfileSha256);
assert.equal(sha256("contracts/release-identity.json"), evidence.identities.releaseContractSha256);
assert.equal(hashDirectory("lib/db/src/schema"), evidence.identities.schemaSourceSha256);

const release = JSON.parse(fs.readFileSync("contracts/release-identity.json", "utf8"));
assert.equal(release.label, evidence.identities.releaseLabel);
assert.equal(release.binaryVersion, evidence.identities.binaryVersion);
assert.equal(evidence.integrationPolicy.forcePushAllowed, false);
assert.equal(evidence.integrationPolicy.workingBehaviorPreserved, true);
assert.equal(evidence.acceptanceState, "IMPLEMENTED_TESTED_NOT_PUSHED");

console.log("BIMLog GA Build 71: PASS exact release lineage and source identities");
