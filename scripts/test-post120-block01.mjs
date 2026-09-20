import assert from "node:assert/strict";
import fs from "node:fs";

const baseline = JSON.parse(fs.readFileSync(new URL("./platform-audit-baseline.json", import.meta.url), "utf8"));
const normalized = JSON.parse(fs.readFileSync(new URL("../evidence/stabilization-program-20260919/PLATFORM_AUDIT_NORMALIZED.json", import.meta.url), "utf8"));
const policy = JSON.parse(fs.readFileSync(new URL("./platform-audit-policy.json", import.meta.url), "utf8"));

assert.deepEqual(baseline.counts, { P0: 0, P1: 66, P2: 0, INFO: 0 });
assert.deepEqual(normalized.counts, baseline.counts);
assert.equal(baseline.rootCauseGroups.length, 38);
assert.equal(normalized.rootCauseGroups.length, 38);
assert.equal(new Set(baseline.findings.map(({ findingId }) => findingId)).size, 66);
assert.deepEqual(
  Object.fromEntries(Object.entries(normalized.categories).map(([key, value]) => [key, value.count])),
  { "bespoke-pdf": 2, "emoji-source": 1, "silent-catch": 63 },
);
assert.ok(baseline.findings.every(({ owner, targetBuild, disposition, sourceKind }) =>
  owner && Number.isInteger(targetBuild) && disposition && ["production", "test"].includes(sourceKind)));
assert.ok(Object.values(policy.categories).every(({ owner }) => owner));
assert.equal(normalized.baseline.unexpectedP1.length, 0);
assert.equal(normalized.baseline.resolvedP1.length, 0);

console.log("POST120_BLOCK01=PASS findings=66 rootCauseGroups=38 unexpectedP1=0 p0=0");
