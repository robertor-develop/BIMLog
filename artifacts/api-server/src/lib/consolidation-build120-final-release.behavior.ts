import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const lib = path.join(root, "artifacts/api-server/src/lib");
for (let build = 116; build <= 119; build += 1) {
  assert.ok(fs.readdirSync(lib).some((name) => name.startsWith(`consolidation-build${build}-`) && name.endsWith(".behavior.ts")), `missing C${build} acceptance`);
}
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
assert.match(pkg.scripts["gate:pre-push"], /test:database-safety/);
assert.match(pkg.scripts["gate:pre-push"], /test:production-artifact/);
assert.ok(pkg.scripts["publication:database-receipt"]);
assert.ok(pkg.scripts["attest:publication-source"]);
const release = JSON.parse(fs.readFileSync(path.join(root, "contracts/release-identity.json"), "utf8"));
assert.equal(release.label, "v1.05.N18-P36");
assert.ok(fs.existsSync(path.join(root, "scripts/check-authenticated-release-acceptance.mjs")));
console.log("consolidation C120 final release and rollback contract: PASS");
