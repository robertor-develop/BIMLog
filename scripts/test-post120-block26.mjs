import assert from "node:assert/strict";
import fs from "node:fs";

const read = (relative) => fs.readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");
const normalized = JSON.parse(read("evidence/stabilization-program-20260919/PLATFORM_AUDIT_NORMALIZED.json"));
const classification = JSON.parse(read("evidence/stabilization-program-20260919/BLOCK_26_SILENT_FAILURE_CLASSIFICATION.json"));
const expectedResolved = ["AUD-00C88CD223CC", "AUD-4BF3C701F3B4", "AUD-7AE788FF597C", "AUD-A315DD285073", "AUD-C3C7BFB4BDCC"].sort();

assert.equal(normalized.counts.P0, 0);
assert.equal(normalized.counts.P1, 61);
assert.equal(normalized.rootCauseGroups.length, 34);
assert.equal(normalized.baseline.unexpectedP1.length, 0);
assert.deepEqual([...normalized.baseline.resolvedP1].sort(), expectedResolved);
assert.deepEqual(classification.classifiedOccurrences.map(({ findingId }) => findingId).sort(), expectedResolved);

const lease = read("artifacts/api-server/src/lib/connector-credential-lease-resolver.ts");
const lifecycle = read("artifacts/api-server/src/lib/connector-credential-lifecycle-postgres-store.ts");
const runtime = read("artifacts/api-server/src/lib/runtime-security.ts");
const session = read("artifacts/bimlog/src/store/session-continuity.ts");
const lens = read("artifacts/bimlog/src/features/lens-next/lens-next-client.ts");
assert.doesNotMatch(`${lease}\n${lifecycle}`, /ROLLBACK"\)\.catch\(\(\) => undefined\)/);
assert.doesNotMatch(lens, /response\.json\(\)\.catch\(\(\) => null\)/);
for (const code of ["CONNECTOR_CREDENTIAL_LEASE_ROLLBACK_FAILED", "CONNECTOR_CREDENTIAL_LIFECYCLE_ROLLBACK_FAILED", "PUBLIC_ORIGIN_CONFIGURATION_INVALID"])
  assert.match(`${lease}\n${lifecycle}\n${runtime}`, new RegExp(code));
for (const code of ["SESSION_STORAGE_INVALID", "BRIDGE_RESPONSE_JSON_INVALID", "BRIDGE_PROBE_FAILED", "BRIDGE_SESSION_RENEWAL_REQUIRED"])
  assert.match(`${session}\n${lens}`, new RegExp(code));

console.log("POST120_BLOCK26=PASS resolvedP1=5 currentP1=61 rootCauseGroups=34 diagnostics=code-only");
