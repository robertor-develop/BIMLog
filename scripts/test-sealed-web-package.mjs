import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { sealDirectory } from "./sealed-web-package.mjs";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "bimlog-seal-"));
try {
  fs.mkdirSync(path.join(root, "z"));
  fs.writeFileSync(path.join(root, "z", "b.txt"), "two");
  fs.writeFileSync(path.join(root, "a.txt"), "one");
  const first = sealDirectory(root);
  const second = sealDirectory(root);
  assert.deepEqual(first, second);
  assert.deepEqual(first.files.map((entry) => entry.path), ["a.txt", "z/b.txt"]);
  fs.writeFileSync(path.join(root, "a.txt"), "changed");
  assert.notEqual(sealDirectory(root).manifestSha256, first.manifestSha256);
  console.log("SEALED_WEB_PACKAGE=PASS");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
