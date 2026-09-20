import assert from "node:assert/strict";
import fs from "node:fs";

const baseline = JSON.parse(fs.readFileSync(new URL("./platform-audit-baseline.json", import.meta.url), "utf8"));
const normalized = JSON.parse(fs.readFileSync(new URL("../evidence/stabilization-program-20260919/PLATFORM_AUDIT_NORMALIZED.json", import.meta.url), "utf8"));
const policy = JSON.parse(fs.readFileSync(new URL("./platform-audit-policy.json", import.meta.url), "utf8"));

assert.deepEqual(baseline.counts, { P0: 0, P1: 66, P2: 0, INFO: 0 });
assert.equal(normalized.counts.P0, 0);
assert.ok(normalized.counts.P1 <= baseline.counts.P1);
assert.equal(baseline.rootCauseGroups.length, 38);
assert.ok(normalized.rootCauseGroups.length <= 38);
assert.equal(new Set(baseline.findings.map(({ findingId }) => findingId)).size, 66);
assert.equal(normalized.categories["bespoke-pdf"].count, 2);
assert.equal(normalized.categories["emoji-source"].count, 1);
assert.ok(normalized.categories["silent-catch"].count <= 63);
assert.ok(baseline.findings.every(({ owner, targetBuild, disposition, sourceKind }) =>
  owner && Number.isInteger(targetBuild) && disposition && ["production", "test"].includes(sourceKind)));
assert.ok(Object.values(policy.categories).every(({ owner }) => owner));
assert.equal(normalized.baseline.unexpectedP1.length, 0);
assert.equal(normalized.baseline.resolvedP1.length, baseline.counts.P1 - normalized.counts.P1);

console.log(`POST120_BLOCK01=PASS baseline=66 current=${normalized.counts.P1} rootCauseGroups=${normalized.rootCauseGroups.length} unexpectedP1=0 p0=0`);
