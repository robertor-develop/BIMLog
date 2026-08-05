import {
  PROCORE_RFI_HEADERS,
  PROCORE_RFI_LIMITS,
  previewProcoreRfiCsv,
  type ProcoreProjectIdentity,
  type ProcoreRfiRow,
} from "./procore-rfi-import";

export const RFI_IMPORT_CAPABILITY = "RFI_IMPORT" as const;
export const PROCORE_RFI_ALLOWED_TARGET_PROJECT_ID = 26 as const;
export const PROCORE_RFI_ALLOWED_ROW_COUNT = 43 as const;
const MAX_IDEMPOTENCY_KEY_BYTES = 128;
const MAX_PROJECT_CODE_BYTES = 128;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const SAFE_KEY_PATTERN = /^[A-Za-z0-9._:-]+$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

export type CommitProcoreRfiImportInput = {
  projectId: number;
  expectedProjectCode: string;
  expectedCompanyId: number;
  expectedSourceSha256: string;
  expectedRowCount: number;
  sourceProject: ProcoreProjectIdentity;
  idempotencyKey: string;
  csvText: string;
  actorUserId: number;
};

export type RfiImportAuthorizationRequirement = {
  projectId: number;
  projectCode: string;
  companyId: number;
  provider: "procore";
  sourceProjectCode: string;
  sourceProjectIdentityDigest: string;
  capability: typeof RFI_IMPORT_CAPABILITY;
  actorUserId: number;
};

export type VerifiedRfiImportAuthorization = RfiImportAuthorizationRequirement & {
  bindingId: number;
  bindingVersion: number;
  bindingAuditIdentity: string;
  current: boolean;
  revokedAt: string | null;
  actorAuthorized: boolean;
};

export type AtomicImportRequest = {
  authorization: RfiImportAuthorizationRequirement;
  idempotencyKey: string;
  sourceDigest: string;
  rowCount: number;
  rows: Array<{
    sourceNumber: string;
    sourceRevision: number;
    sourcePayload: ProcoreRfiRow;
  }>;
};

export type AtomicImportResult =
  | { outcome: "created"; importId: number; rowCount: number; digest: string }
  | { outcome: "replay"; importId: number; rowCount: number; digest: string }
  | { outcome: "duplicate"; duplicateCount: number; rowCount: 0; digest: string };

export interface ProcoreRfiImportStore {
  /** Authorization lookup, binding lock, replay/duplicate decision and inserts must share one transaction. */
  atomicImport(request: AtomicImportRequest): Promise<AtomicImportResult>;
}

export type StoredRfiImportReplay = {
  importId: number;
  sourceDigest: string;
  sourceProjectIdentityDigest: string;
  rowCount: number;
};

export interface ProductionRfiImportTransaction {
  /** Must lock the selected current binding version so revocation/version changes serialize with this import. */
  lockAndLoadAuthorization(requirement: RfiImportAuthorizationRequirement): Promise<VerifiedRfiImportAuthorization | null>;
  findReplay(requirement: RfiImportAuthorizationRequirement, idempotencyKey: string): Promise<StoredRfiImportReplay | null>;
  countSourceDuplicates(
    requirement: RfiImportAuthorizationRequirement,
    rows: AtomicImportRequest["rows"],
  ): Promise<number>;
  insertImportWithRows(
    authorization: VerifiedRfiImportAuthorization,
    request: AtomicImportRequest,
  ): Promise<{ importId: number }>;
}

export interface ProductionRfiImportDatabase {
  transaction<T>(work: (transaction: ProductionRfiImportTransaction) => Promise<T>): Promise<T>;
}

function sourcePayloadIsValid(
  payload: ProcoreRfiRow,
  sourceNumber: string,
  sourceRevision: number,
): boolean {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) return false;
  const keys = Object.keys(payload);
  if (keys.length !== PROCORE_RFI_HEADERS.length
    || keys.some((key) => !(PROCORE_RFI_HEADERS as readonly string[]).includes(key))) return false;
  if (payload.Number !== sourceNumber || payload.Revision !== String(sourceRevision)) return false;
  if (PROCORE_RFI_HEADERS.some((header) => (
    typeof payload[header] !== "string"
    || Buffer.byteLength(payload[header], "utf8") > PROCORE_RFI_LIMITS.fieldBytes
    || CONTROL_CHARACTER_PATTERN.test(payload[header])
  ))) return false;
  return Buffer.byteLength(JSON.stringify(payload), "utf8") <= PROCORE_RFI_LIMITS.rowBytes;
}

/** Fail-closed boundary shared by every exported persistence adapter. */
export function assertAtomicImportRequest(request: AtomicImportRequest): void {
  const authorization = request?.authorization;
  const idempotencyKey = request?.idempotencyKey;
  const projectCode = authorization?.projectCode;
  const sourceProjectCode = authorization?.sourceProjectCode;
  const rows = request?.rows;
  const valid = authorization
    && authorization.projectId === PROCORE_RFI_ALLOWED_TARGET_PROJECT_ID
    && authorization.provider === "procore"
    && authorization.capability === RFI_IMPORT_CAPABILITY
    && Number.isSafeInteger(authorization.companyId) && authorization.companyId > 0
    && Number.isSafeInteger(authorization.actorUserId) && authorization.actorUserId > 0
    && typeof projectCode === "string" && projectCode.length > 0 && projectCode === projectCode.trim()
    && Buffer.byteLength(projectCode, "utf8") <= MAX_PROJECT_CODE_BYTES
    && !CONTROL_CHARACTER_PATTERN.test(projectCode)
    && typeof sourceProjectCode === "string" && sourceProjectCode.length > 0
    && sourceProjectCode === sourceProjectCode.trim()
    && Buffer.byteLength(sourceProjectCode, "utf8") <= MAX_PROJECT_CODE_BYTES
    && !CONTROL_CHARACTER_PATTERN.test(sourceProjectCode)
    && typeof authorization.sourceProjectIdentityDigest === "string"
    && SHA256_PATTERN.test(authorization.sourceProjectIdentityDigest)
    && typeof idempotencyKey === "string" && idempotencyKey.length > 0
    && idempotencyKey === idempotencyKey.trim()
    && Buffer.byteLength(idempotencyKey, "utf8") <= MAX_IDEMPOTENCY_KEY_BYTES
    && SAFE_KEY_PATTERN.test(idempotencyKey)
    && typeof request.sourceDigest === "string" && SHA256_PATTERN.test(request.sourceDigest)
    && request.rowCount === PROCORE_RFI_ALLOWED_ROW_COUNT
    && Array.isArray(rows) && rows.length === PROCORE_RFI_ALLOWED_ROW_COUNT
    && rows.every((row) => row && typeof row.sourceNumber === "string"
      && row.sourceNumber.length > 0 && row.sourceNumber === row.sourceNumber.trim()
      && !CONTROL_CHARACTER_PATTERN.test(row.sourceNumber)
      && Number.isSafeInteger(row.sourceRevision) && row.sourceRevision >= 0
      && sourcePayloadIsValid(row.sourcePayload, row.sourceNumber, row.sourceRevision));
  const retainedPayloadBytes = Array.isArray(rows)
    ? rows.reduce((total, row) => total + Buffer.byteLength(JSON.stringify(row?.sourcePayload ?? null), "utf8"), 0)
    : 0;
  const identities = Array.isArray(rows)
    ? new Set(rows.map((row) => `${row.sourceNumber}\u0000${row.sourceRevision}`))
    : new Set<string>();
  if (!valid
    || identities.size !== PROCORE_RFI_ALLOWED_ROW_COUNT
    || retainedPayloadBytes > PROCORE_RFI_LIMITS.retainedPayloadBytes) {
    throw new Error("RFI_IMPORT_REQUEST_INVALID");
  }
}

function assertAuthorization(
  authorization: VerifiedRfiImportAuthorization | null,
  required: RfiImportAuthorizationRequirement,
): asserts authorization is VerifiedRfiImportAuthorization {
  const valid = authorization
    && authorization.bindingId > 0
    && authorization.bindingVersion > 0
    && authorization.bindingAuditIdentity.trim().length > 0
    && authorization.projectId === required.projectId
    && authorization.projectCode === required.projectCode
    && authorization.companyId === required.companyId
    && authorization.provider === required.provider
    && authorization.sourceProjectCode === required.sourceProjectCode
    && authorization.sourceProjectIdentityDigest === required.sourceProjectIdentityDigest
    && authorization.capability === required.capability
    && authorization.actorUserId === required.actorUserId
    && authorization.current
    && authorization.revokedAt === null
    && authorization.actorAuthorized;
  if (!valid) throw new Error("RFI_IMPORT_AUTHORIZATION_DENIED");
}

export function createProductionProcoreRfiImportStore(
  database: ProductionRfiImportDatabase,
): ProcoreRfiImportStore {
  return {
    atomicImport: (request) => {
      assertAtomicImportRequest(request);
      return database.transaction(async (transaction) => {
      const authorization = await transaction.lockAndLoadAuthorization(request.authorization);
      assertAuthorization(authorization, request.authorization);

      const replay = await transaction.findReplay(
        request.authorization,
        request.idempotencyKey,
      );
      if (replay) {
        const identical = replay.sourceDigest === request.sourceDigest
          && replay.sourceProjectIdentityDigest === request.authorization.sourceProjectIdentityDigest
          && replay.rowCount === request.rowCount;
        if (!identical) throw new Error("RFI_IMPORT_IDEMPOTENCY_CONFLICT");
        return { outcome: "replay", importId: replay.importId, rowCount: replay.rowCount, digest: replay.sourceDigest };
      }

      const duplicateCount = await transaction.countSourceDuplicates(
        request.authorization,
        request.rows,
      );
      if (duplicateCount > 0) return { outcome: "duplicate", duplicateCount, rowCount: 0, digest: request.sourceDigest };

      const created = await transaction.insertImportWithRows(authorization, request);
      return { outcome: "created", importId: created.importId, rowCount: request.rowCount, digest: request.sourceDigest };
      });
    },
  };
}

export async function commitProcoreRfiImport(
  input: CommitProcoreRfiImportInput,
  store: ProcoreRfiImportStore,
): Promise<AtomicImportResult> {
  const idempotencyKey = input.idempotencyKey.trim();
  if (idempotencyKey !== input.idempotencyKey
    || !idempotencyKey
    || Buffer.byteLength(idempotencyKey, "utf8") > MAX_IDEMPOTENCY_KEY_BYTES
    || !SAFE_KEY_PATTERN.test(idempotencyKey)) {
    throw new Error("RFI_IMPORT_IDEMPOTENCY_KEY_INVALID");
  }
  const expectedProjectCode = input.expectedProjectCode.trim();
  if (input.projectId !== PROCORE_RFI_ALLOWED_TARGET_PROJECT_ID
    || input.expectedRowCount !== PROCORE_RFI_ALLOWED_ROW_COUNT
    || !Number.isInteger(input.expectedCompanyId) || input.expectedCompanyId < 1
    || !Number.isInteger(input.actorUserId) || input.actorUserId < 1
    || !expectedProjectCode
    || expectedProjectCode !== input.expectedProjectCode
    || Buffer.byteLength(expectedProjectCode, "utf8") > MAX_PROJECT_CODE_BYTES
    || CONTROL_CHARACTER_PATTERN.test(expectedProjectCode)) {
    throw new Error("RFI_IMPORT_TARGET_INVALID");
  }
  const preview = previewProcoreRfiCsv(input.csvText, {
    sha256: input.expectedSourceSha256,
    rowCount: input.expectedRowCount,
    project: input.sourceProject,
  });
  if (!preview.valid) throw new Error(`RFI_IMPORT_INVALID:${preview.errors.join(",")}`);

  return store.atomicImport({
    authorization: {
      projectId: input.projectId,
      projectCode: expectedProjectCode,
      companyId: input.expectedCompanyId,
      provider: "procore",
      sourceProjectCode: preview.project.code,
      sourceProjectIdentityDigest: preview.projectIdentityDigest,
      capability: RFI_IMPORT_CAPABILITY,
      actorUserId: input.actorUserId,
    },
    idempotencyKey,
    sourceDigest: preview.digest,
    rowCount: preview.rowCount,
    rows: preview.rows.map((row) => ({
      sourceNumber: row.sourceNumber,
      sourceRevision: row.revision,
      sourcePayload: row.raw,
    })),
  });
}
