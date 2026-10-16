import { createHash } from "node:crypto";
import { isGaProtectedProjectId } from "./ga-protected-projects";

export type ProtectedFileInventoryRow = Readonly<{
  projectId: number;
  fileId: number;
  fileName: string;
  expectedBytes: number;
  expectedSha256: string | null;
  source: string;
  storagePathPresent: boolean;
}>;

const SHA256 = /^[a-f0-9]{64}$/;

export function reconcileProtectedFileInventory(rows: readonly ProtectedFileInventoryRow[]) {
  const seen = new Set<number>();
  const normalized = rows.map(row => {
    if (!isGaProtectedProjectId(row.projectId)) throw new Error("GA_FILE_PROJECT_NOT_PROTECTED");
    if (!Number.isSafeInteger(row.fileId) || row.fileId <= 0 || seen.has(row.fileId)) throw new Error("GA_FILE_ID_INVALID");
    if (!row.fileName.trim() || !Number.isSafeInteger(row.expectedBytes) || row.expectedBytes <= 0) throw new Error("GA_FILE_IDENTITY_INVALID");
    if (row.expectedSha256 !== null && !SHA256.test(row.expectedSha256)) throw new Error("GA_FILE_HASH_INVALID");
    seen.add(row.fileId);
    return { ...row, fileName: row.fileName.trim() };
  }).sort((a, b) => a.projectId - b.projectId || a.fileId - b.fileId);
  const missingStoragePath = normalized.filter(row => !row.storagePathPresent);
  const missingHash = normalized.filter(row => row.expectedSha256 === null);
  const blocked = normalized.filter(row => !row.storagePathPresent || row.expectedSha256 === null);
  const body = {
    total: normalized.length,
    blocked: blocked.length,
    missingStoragePath: missingStoragePath.length,
    missingHash: missingHash.length,
    restorableNow: normalized.length - blocked.length,
    projectCounts: Object.fromEntries([23, 26, 35].map(projectId => [projectId, normalized.filter(row => row.projectId === projectId).length])),
    rows: normalized,
  };
  return Object.freeze({ ...body, sha256: createHash("sha256").update(JSON.stringify(body)).digest("hex") });
}
