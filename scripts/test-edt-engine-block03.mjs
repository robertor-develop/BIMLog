import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
assert.ok(process.env.npm_execpath, "pnpm execution path is required");
execFileSync(process.execPath, [process.env.npm_execpath, "--filter", "@workspace/api-server", "run", "test:edt-engine-block03"], { cwd: root, stdio: "inherit" });

const changed = execFileSync("git", ["diff", "--name-only", "00d587c6522af756554a8ff1fde2a55e49105432", "HEAD"], { cwd: root, encoding: "utf8" })
  .split(/\r?\n/).filter(Boolean);
for (const protectedPrefix of ["BIMLogNavisPlugin/", "source-2021/", "installer/", "plugins/BIMLogLensNext/"]) {
  assert.equal(changed.some((file) => file.startsWith(protectedPrefix)), false, `Block 3 changed protected Native path: ${protectedPrefix}`);
}

const ledger = JSON.parse(fs.readFileSync(path.join(root, "evidence/edt-engine-program-20260922/BUILD_LEDGER.json"), "utf8"));
assert.equal(ledger.range.completedThrough, 290);
assert.equal(ledger.currentBlock.status, "PASS_LOCAL");
assert.equal(ledger.currentBlock.publicationDue, false);
assert.equal(ledger.lensNext.focusedNavisworksSmoke, "NOT_REQUIRED");
console.log("EDT_ENGINE_BLOCK03_RESULT=PASS");
