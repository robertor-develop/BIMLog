import assert from "node:assert/strict";
import fs from "node:fs";

const policy = JSON.parse(fs.readFileSync(new URL("./platform-audit-policy.json", import.meta.url), "utf8"));
const source = fs.readFileSync(new URL("./platform-audit.mjs", import.meta.url), "utf8");
assert.deepEqual(policy.blockingSeverities, ["P0"]);
for (const category of ["old-replit-url", "ai-billing-bypass", "dummy-ai-key", "super-admin-permission-bypass"]) {
  assert.equal(policy.categories[category].blocking, true);
  assert.ok(policy.categories[category].owner);
}
for (const category of ["bespoke-pdf", "emoji-source", "silent-catch", "duplicate-route", "route-order"]) {
  assert.equal(policy.categories[category].blocking, false);
  assert.ok(Number.isInteger(policy.categories[category].targetBuild));
}
assert.match(source, /--enforce/);
assert.match(source, /receipt\.counts\.P0 > 0/);
assert.match(source, /Audit categories lack owners/);
console.log("PLATFORM_AUDIT_POLICY=PASS blocking=P0 deferredP1=owned");
