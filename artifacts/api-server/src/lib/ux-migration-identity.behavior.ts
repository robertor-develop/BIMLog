import assert from "node:assert/strict";
import { migrationIdentityDryRun, type MigrationIdentity } from "./ux-migration-identity";

const source: MigrationIdentity[] = [
  { entity: "company", sourceId: "company-1", targetId: null, sourceFingerprint: "a", targetFingerprint: null, displayName: "ACME" },
  { entity: "file", sourceId: "file-2", targetId: null, sourceFingerprint: "b", targetFingerprint: null, displayName: "Coordination.rvt" },
];
const target: MigrationIdentity[] = [
  { entity: "company", sourceId: "company-1", targetId: "company-1", sourceFingerprint: "a", targetFingerprint: "a", displayName: "ACME renamed" },
  { entity: "file", sourceId: "unrelated-file", targetId: "file-9", sourceFingerprint: "b", targetFingerprint: "b", displayName: "Coordination.rvt" },
];

const reviewRequired = migrationIdentityDryRun(source, target, []);
assert.equal(reviewRequired.status, "review_required");
assert.deepEqual(reviewRequired.mappings, [{ sourceId: "company-1", targetId: "company-1", basis: "stable_identity" }]);
assert.deepEqual(reviewRequired.unmappedSourceIds, ["file-2"]);
assert.equal(reviewRequired.writesPerformed, 0);

const reviewed = migrationIdentityDryRun(source, target, [{ sourceId: "file-2", targetId: "file-9", reviewedBy: "qa-owner", reviewedAt: "2026-09-30T01:00:00Z", reason: "Verified immutable file custody lineage" }]);
assert.equal(reviewed.status, "ready");
assert.equal(reviewed.mappings[1].basis, "explicit_review");
assert.match(reviewed.digest, /^[a-f0-9]{64}$/);
console.log("UX091 migration identity plan and dry run: PASS");
