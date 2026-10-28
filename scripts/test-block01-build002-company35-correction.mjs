import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contract = JSON.parse(fs.readFileSync(path.join(root, "contracts/company-35-binding-correction.json"), "utf8"));
assert.equal(contract.schemaVersion, "bimlog-company-binding-correction-v1");
assert.equal(contract.sourceCompanyId, 35);
assert.equal(contract.targetCompanyId, 31);
assert.deepEqual(contract.excludedCompanyIds, [38], "company 38 must remain outside identity reconciliation");
assert.deepEqual(contract.projectIds, [36, 37, 38, 39, 40, 47, 48, 52, 54]);
assert.equal(new Set(contract.projectIds).size, 9);
assert.equal(contract.bindingPolicy, "append_only_version");
for (const gate of ["authority", "dry_run_rollback", "expected_version", "idempotent_replay", "collision_isolation", "persistence"])
  assert.ok(contract.requiredGates.includes(gate), `missing ${gate}`);
for (const protectedItem of ["company_ids", "project_ids", "binding_history", "memberships", "roles", "accepted_evidence"])
  assert.ok(contract.preserve.includes(protectedItem), `missing protected item ${protectedItem}`);
const source = fs.readFileSync(path.join(root, "artifacts/api-server/src/lib/company-identity-reconciliation.ts"), "utf8");
for (const invariant of [
  "RECONCILIATION_AUTHORITY_REQUIRED",
  "RECONCILIATION_BINDING_CHANGED",
  "RECONCILIATION_UNPLANNED_PROJECT",
  "supersedes_binding_id",
  'apply?"COMMIT":"ROLLBACK"',
]) assert.ok(source.includes(invariant), `implementation invariant missing: ${invariant}`);
const evidence = fs.readFileSync(path.join(root, contract.productionEvidence.evidencePath), "utf8");
assert.match(evidence, /changed project IDs `\[36,37,38,39,40,47,48,52,54\]`/);
assert.match(evidence, /company38 remains unretired and unchanged/);
assert.match(evidence, /immutable company35 version1/);
console.log("BLOCK01_BUILD002=PASS bindings=9 append_only=true company38_excluded=true");
