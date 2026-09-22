import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
assert.ok(process.env.npm_execpath, "pnpm execution path is required");
execFileSync(process.execPath, [process.env.npm_execpath, "--filter", "@workspace/api-server", "run", "test:edt-engine-block02"], {
  cwd: root,
  stdio: "inherit",
});

const nativePaths = ["BIMLogNavisPlugin", "source-2021", "installer"];
const changed = execFileSync("git", ["diff", "--name-only", "919388a1de0a109c3ebeca2381f3e542830629e0", "HEAD"], { cwd: root, encoding: "utf8" })
  .split(/\r?\n/).filter(Boolean);
assert.equal(changed.some(file => nativePaths.some(prefix => file.startsWith(prefix))), false, "Block 2 must not change Lens Next Native or installers");

const ledger = JSON.parse(fs.readFileSync(path.join(root, "evidence/edt-engine-program-20260922/BUILD_LEDGER.json"), "utf8"));
assert.equal(ledger.range.completedThrough, 285);
assert.equal(ledger.currentBlock.publicationDue, true);
assert.equal(ledger.lensNext.focusedNavisworksSmoke, "NOT_REQUIRED");

console.log("EDT_ENGINE_BLOCK02_RESULT=PASS");
