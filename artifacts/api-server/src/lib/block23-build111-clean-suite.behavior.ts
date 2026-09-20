import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "../..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
assert.equal(pkg.engines.pnpm, ">=10.26.1 <12");
assert.match(pkg.scripts["gate:pre-push"], /test:block23-full-system-acceptance/);
assert.ok(fs.existsSync(path.join(root, "pnpm-lock.yaml")));
console.log("block23 build111 clean-install suite contract: PASS");

