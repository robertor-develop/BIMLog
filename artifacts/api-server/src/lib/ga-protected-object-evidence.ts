import { createHash } from "node:crypto";
import { isGaProtectedProjectId } from "./ga-protected-projects";

export type RegisteredProtectedObject = {
  projectId: number;
  fileId: number;
  storagePath: string | null;
  expectedBytes: number | null;
  expectedSha256: string | null;
};

export type ProtectedObjectEvidence = RegisteredProtectedObject & {
  exists: boolean;
  actualBytes: number | null;
  actualSha256: string | null;
  verified: boolean;
  failureCode: string | null;
};

export function verifyProtectedObject(
  registered: RegisteredProtectedObject,
  bytes: Buffer | null,
): ProtectedObjectEvidence {
  if (!isGaProtectedProjectId(registered.projectId)) throw new Error("GA_OBJECT_PROJECT_NOT_PROTECTED");
  if (!registered.storagePath) return { ...registered, exists: false, actualBytes: null, actualSha256: null, verified: false, failureCode: "STORAGE_PATH_MISSING" };
  if (!bytes) return { ...registered, exists: false, actualBytes: null, actualSha256: null, verified: false, failureCode: "OBJECT_NOT_FOUND" };
  const actualSha256 = createHash("sha256").update(bytes).digest("hex");
  const actualBytes = bytes.byteLength;
  const sizeMatches = registered.expectedBytes !== null && registered.expectedBytes === actualBytes;
  const hashMatches = registered.expectedSha256 !== null && registered.expectedSha256.toLowerCase() === actualSha256;
  return {
    ...registered,
    exists: true,
    actualBytes,
    actualSha256,
    verified: sizeMatches && hashMatches,
    failureCode: sizeMatches && hashMatches ? null : !sizeMatches ? "BYTE_SIZE_MISMATCH" : "SHA256_MISMATCH",
  };
}

export function createProtectedRecoveryEvidence(input: {
  generatedAt: string;
  databaseMigrationLevel: string;
  backupMetadata: { provider: string; snapshotId: string; pitrStartsAt: string; pitrEndsAt: string } | null;
  objects: ProtectedObjectEvidence[];
}) {
  const body = {
    schema: "bimlog.ga-protected-recovery-evidence.v1",
    generatedAt: input.generatedAt,
    databaseMigrationLevel: input.databaseMigrationLevel,
    backupMetadata: input.backupMetadata,
    objects: input.objects,
    complete: input.backupMetadata !== null && input.objects.every(object => object.verified),
  };
  return Object.freeze({ ...body, evidenceSha256: createHash("sha256").update(JSON.stringify(body)).digest("hex") });
}
