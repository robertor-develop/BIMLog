import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { inspectReleaseLineage, requireReleaseLineageParity } from "./check-release-lineage.mjs";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "bimlog-lineage-"));
const git = (...args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
try {
  git("init", "-q");
  git("config", "user.email", "lineage-test@bimlog.invalid");
  git("config", "user.name", "BIMLog lineage test");
  fs.writeFileSync(path.join(root, "source.txt"), "accepted\n");
  git("add", "source.txt");
  git("commit", "-qm", "accepted");
  git("branch", "production");
  git("branch", "canonical");
  const matching = inspectReleaseLineage({ cwd: root, canonicalRef: "canonical", productionRef: "production" });
  assert.equal(requireReleaseLineageParity(matching).treesMatch, true);
  git("checkout", "-q", "production");
  fs.writeFileSync(path.join(root, "source.txt"), "diverged\n");
  git("commit", "-qam", "diverged");
  const divergent = inspectReleaseLineage({ cwd: root, canonicalRef: "canonical", productionRef: "production" });
  assert.equal(divergent.treesMatch, false);
  assert.throws(() => requireReleaseLineageParity(divergent), /do not contain the same source tree/);
  console.log("Release lineage parity behavior: PASS");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
