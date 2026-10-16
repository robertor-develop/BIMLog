import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { matchRecoveryCandidate, requireUniqueVerifiedCandidates } from "./ga-recovery-candidate-match";

const bytes = Buffer.from("authoritative-original");
const record = { projectId: 23, fileId: 12, fileName: "original.docx", expectedBytes: bytes.length, expectedSha256: createHash("sha256").update(bytes).digest("hex"), source: "coordination_hub", storagePathPresent: false } as const;
const verified = matchRecoveryCandidate(record, { fileName: record.fileName, bytes });
assert.equal(verified.state, "verified");
assert.equal(verified.eligibleForRestore, true);
assert.equal(matchRecoveryCandidate(record, { fileName: "other.docx", bytes }).state, "name_mismatch");
assert.equal(matchRecoveryCandidate(record, { fileName: record.fileName, bytes: Buffer.from("short") }).state, "size_mismatch");
const sameSizeWrongBytes = Buffer.from("authoritative-originaL");
assert.equal(sameSizeWrongBytes.length, bytes.length);
assert.equal(matchRecoveryCandidate(record, { fileName: record.fileName, bytes: sameSizeWrongBytes }).state, "hash_mismatch");
assert.equal(matchRecoveryCandidate({ ...record, expectedSha256: null }, { fileName: record.fileName, bytes }).state, "needs_authoritative_hash");
assert.deepEqual(requireUniqueVerifiedCandidates([verified]), [verified]);
assert.throws(() => requireUniqueVerifiedCandidates([verified, verified]), /DUPLICATE/);
assert.throws(() => requireUniqueVerifiedCandidates([matchRecoveryCandidate({ ...record, expectedSha256: null }, { fileName: record.fileName, bytes })]), /NEEDS_AUTHORITATIVE_HASH/);
console.log("B-GA005R2 recovery candidate matching: PASS exact name+size+SHA required; metadata-only candidates rejected");
