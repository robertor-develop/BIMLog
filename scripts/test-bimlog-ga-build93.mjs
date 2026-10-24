import assert from "node:assert/strict";
import fs from "node:fs";

const receipt = JSON.parse(fs.readFileSync("evidence/ga-final-closure-20261024/build93-production-dependency-audit.json", "utf8"));
assert.equal(receipt.schemaVersion, "bimlog-ga-build93-production-dependency-audit-v1");
assert.equal(receipt.registry, "https://registry.npmjs.org");
assert.equal(receipt.scope, "production");
assert.equal(receipt.auditLevel, "high");
assert.equal(receipt.exitCode, 0);
assert.equal(receipt.secretsIncluded, false);
assert.ok(receipt.dependencies > 0);
assert.ok(receipt.totalDependencies >= receipt.dependencies);
for (const count of Object.values(receipt.vulnerabilities)) assert.equal(count, 0);
console.log(`BIMLog GA Build 93: PASS production dependency audit (${receipt.totalDependencies} dependencies, zero vulnerabilities)`);
