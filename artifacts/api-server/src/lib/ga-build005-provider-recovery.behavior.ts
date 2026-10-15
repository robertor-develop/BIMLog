import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createProtectedRecoveryEvidence, verifyProtectedObject } from "./ga-protected-object-evidence";

const bytes = Buffer.from("synthetic protected object fixture");
const verified = verifyProtectedObject({ projectId: 23, fileId: 12, storagePath: "protected/23/12", expectedBytes: bytes.length, expectedSha256: createHash("sha256").update(bytes).digest("hex") }, bytes);
assert.equal(verified.verified, true);
assert.equal(verified.failureCode, null);
assert.equal(verifyProtectedObject({ ...verified, expectedBytes: bytes.length + 1 }, bytes).failureCode, "BYTE_SIZE_MISMATCH");
assert.throws(() => verifyProtectedObject({ projectId: 64, fileId: 1, storagePath: "test", expectedBytes: 0, expectedSha256: "" }, Buffer.alloc(0)), /GA_OBJECT_PROJECT_NOT_PROTECTED/);
const evidence = createProtectedRecoveryEvidence({ generatedAt: "2026-10-14T00:00:00.000Z", databaseMigrationLevel: "schema-test", backupMetadata: null, objects: [verified] });
assert.equal(evidence.complete, false);
assert.match(evidence.evidenceSha256, /^[a-f0-9]{64}$/);

console.log("B_GA005=PASS objectChecksums=fail-closed backupMetadataRequired=true");
