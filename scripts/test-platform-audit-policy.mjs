import assert from "node:assert/strict";
import fs from "node:fs";

const policy = JSON.parse(fs.readFileSync(new URL("./platform-audit-policy.json", import.meta.url), "utf8"));
const source = fs.readFileSync(new URL("./platform-audit.mjs", import.meta.url), "utf8");
const baseline = JSON.parse(fs.readFileSync(new URL("./platform-audit-baseline.json", import.meta.url), "utf8"));
assert.deepEqual(policy.blockingSeverities, ["P0"]);
for (const category of ["old-replit-url", "ai-billing-bypass", "dummy-ai-key", "super-admin-permission-bypass"]) {
  assert.equal(policy.categories[category].blocking, true);
  assert.ok(policy.categories[category].owner);
}
for (const category of ["bespoke-pdf", "emoji-source", "silent-catch", "duplicate-route", "route-order"]) {
  assert.equal(policy.categories[category].blocking, false);
  assert.ok(Number.isInteger(policy.categories[category].targetBuild));
  assert.ok(policy.categories[category].targetBuild >= 121);
  assert.ok(policy.categories[category].disposition);
}
assert.match(source, /--enforce/);
assert.match(source, /unexpectedP1\.length > 0/);
assert.match(source, /Audit categories lack owners/);
assert.equal(baseline.schemaVersion, 1);
assert.equal(baseline.findings.length, baseline.counts.P1);
assert.ok(baseline.findings.every((finding) => finding.findingId && finding.owner && finding.disposition && Number.isInteger(finding.targetBuild)));
assert.equal(new Set(baseline.findings.map((finding) => finding.findingId)).size, baseline.findings.length);
console.log(`PLATFORM_AUDIT_POLICY=PASS blocking=P0 unexpectedP1=blocked baseline=${baseline.findings.length}`);
