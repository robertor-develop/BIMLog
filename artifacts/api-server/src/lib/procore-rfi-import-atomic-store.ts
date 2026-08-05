import type {
  AtomicImportRequest,
  AtomicImportResult,
  ProcoreRfiImportStore,
  VerifiedRfiImportAuthorization,
} from "./procore-rfi-import-commit";
import { assertAtomicImportRequest } from "./procore-rfi-import-commit";

type QueryResult<Row> = { rows: Row[]; rowCount: number | null };
export interface ProcoreRfiPgClient {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<Row>>;
  release(): void;
}
export interface ProcoreRfiPgPool {
  connect(): Promise<ProcoreRfiPgClient>;
}

type AuthorizationRow = {
  binding_id: number;
  binding_version: number;
  binding_audit_identity: string;
  project_id: number;
  project_code: string;
  company_id: number;
  source_project_code: string;
  source_project_identity_digest: string;
  actor_user_id: number;
};
type ReplayRow = {
  id: number;
  source_digest: string;
  source_project_identity_digest: string;
  row_count: number;
};
type CountRow = { duplicate_count: string | number };
type InsertRow = { id: number };
type PgConstraintError = Error & { code?: string; constraint?: string };
const MAX_TRANSACTION_ATTEMPTS = 3;

function authorizationFromRow(row: AuthorizationRow): VerifiedRfiImportAuthorization {
  return {
    bindingId: Number(row.binding_id),
    bindingVersion: Number(row.binding_version),
    bindingAuditIdentity: row.binding_audit_identity,
    projectId: Number(row.project_id),
    projectCode: row.project_code,
    companyId: Number(row.company_id),
    provider: "procore",
    sourceProjectCode: row.source_project_code,
    sourceProjectIdentityDigest: row.source_project_identity_digest,
    capability: "RFI_IMPORT",
    current: true,
    revokedAt: null,
    actorUserId: Number(row.actor_user_id),
    actorAuthorized: true,
  };
}

function authorizationMatches(row: VerifiedRfiImportAuthorization, request: AtomicImportRequest): boolean {
  const required = request.authorization;
  return row.bindingId > 0 && row.bindingVersion > 0 && row.bindingAuditIdentity.length > 0
    && row.projectId === required.projectId && row.projectCode === required.projectCode
    && row.companyId === required.companyId && row.provider === required.provider
    && row.sourceProjectCode === required.sourceProjectCode
    && row.sourceProjectIdentityDigest === required.sourceProjectIdentityDigest
    && row.capability === required.capability && row.actorUserId === required.actorUserId
    && row.current && row.revokedAt === null && row.actorAuthorized;
}

async function rollback(client: ProcoreRfiPgClient): Promise<void> {
  try { await client.query("ROLLBACK"); } catch { /* original failure remains authoritative */ }
}

/** Concrete node-postgres-compatible adapter. It never opens a connection until atomicImport is called. */
export function createPostgresProcoreRfiImportStore(pool: ProcoreRfiPgPool): ProcoreRfiImportStore {
  return {
    async atomicImport(request): Promise<AtomicImportResult> {
      assertAtomicImportRequest(request);
      const client = await pool.connect();
      try {
        for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
          try {
            await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
            const authorizationResult = await client.query<AuthorizationRow>(`
          SELECT b.id AS binding_id, b.version AS binding_version,
                 b.audit_identity AS binding_audit_identity, b.project_id,
                 p.code AS project_code, b.company_id, b.source_project_code,
                 b.source_project_identity_digest, a.user_id AS actor_user_id
            FROM rfi_import_bindings b
            JOIN projects p ON p.id = b.project_id
            JOIN rfi_import_authorizations a
              ON a.binding_id = b.id AND a.binding_version = b.version
             AND a.capability = b.capability
           WHERE b.project_id = $1 AND p.code = $2 AND b.company_id = $3
             AND b.provider = $4 AND b.source_project_code = $5
             AND b.source_project_identity_digest = $6 AND b.capability = $7
             AND a.user_id = $8 AND b.current = true AND b.revoked_at IS NULL
             AND a.current = true AND a.revoked_at IS NULL
           ORDER BY b.version DESC LIMIT 1
           FOR UPDATE OF b, a
        `, [
          request.authorization.projectId, request.authorization.projectCode,
          request.authorization.companyId, request.authorization.provider,
          request.authorization.sourceProjectCode, request.authorization.sourceProjectIdentityDigest,
          request.authorization.capability, request.authorization.actorUserId,
        ]);
            const authorization = authorizationResult.rows[0]
              ? authorizationFromRow(authorizationResult.rows[0])
              : null;
            if (!authorization || !authorizationMatches(authorization, request)) {
              throw new Error("RFI_IMPORT_AUTHORIZATION_DENIED");
            }

            const replayResult = await client.query<ReplayRow>(`
          SELECT id, source_digest, source_project_identity_digest, row_count
            FROM rfi_imports
           WHERE project_id = $1 AND provider = $2 AND source_project_code = $3
             AND idempotency_key = $4
           FOR UPDATE
        `, [
          request.authorization.projectId, request.authorization.provider,
          request.authorization.sourceProjectCode, request.idempotencyKey,
        ]);
            const replay = replayResult.rows[0];
            if (replay) {
              if (replay.source_digest !== request.sourceDigest
                || replay.source_project_identity_digest !== request.authorization.sourceProjectIdentityDigest
                || Number(replay.row_count) !== request.rowCount) {
                throw new Error("RFI_IMPORT_IDEMPOTENCY_CONFLICT");
              }
              await client.query("COMMIT");
              return { outcome: "replay", importId: Number(replay.id), rowCount: Number(replay.row_count), digest: replay.source_digest };
            }

            const identityPayload = request.rows.map((row) => ({
              source_number: row.sourceNumber,
              source_revision: row.sourceRevision,
            }));
            const duplicateResult = await client.query<CountRow>(`
          SELECT count(*) AS duplicate_count
            FROM rfi_import_rows existing
            JOIN jsonb_to_recordset($4::jsonb)
              AS incoming(source_number text, source_revision integer)
              ON incoming.source_number = existing.source_number
             AND incoming.source_revision = existing.source_revision
           WHERE existing.project_id = $1 AND existing.provider = $2
             AND existing.source_project_code = $3
        `, [
          request.authorization.projectId, request.authorization.provider,
          request.authorization.sourceProjectCode, JSON.stringify(identityPayload),
        ]);
            const duplicateCount = Number(duplicateResult.rows[0]?.duplicate_count ?? 0);
            if (duplicateCount > 0) {
              await client.query("ROLLBACK");
              return { outcome: "duplicate", duplicateCount, rowCount: 0, digest: request.sourceDigest };
            }

            const insertedImport = await client.query<InsertRow>(`
          INSERT INTO rfi_imports (
            project_id, provider, binding_id, binding_version, binding_audit_identity,
            idempotency_key, source_digest, source_project_code,
            source_project_identity_digest, actor_user_id, row_count
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
          RETURNING id
        `, [
          request.authorization.projectId, request.authorization.provider,
          authorization.bindingId, authorization.bindingVersion, authorization.bindingAuditIdentity,
          request.idempotencyKey, request.sourceDigest, request.authorization.sourceProjectCode,
          request.authorization.sourceProjectIdentityDigest, request.authorization.actorUserId, request.rowCount,
        ]);
            const importId = Number(insertedImport.rows[0]?.id);
            if (!Number.isSafeInteger(importId) || importId < 1) throw new Error("RFI_IMPORT_INSERT_FAILED");

            const rowPayload = request.rows.map((row) => ({
              source_number: row.sourceNumber,
              source_revision: row.sourceRevision,
              source_payload: row.sourcePayload,
            }));
            const insertedRows = await client.query<InsertRow>(`
          INSERT INTO rfi_import_rows (
            import_id, project_id, provider, source_project_code, binding_id, binding_version,
            source_number, source_revision, source_payload
          )
          SELECT $1,$2,$3,$4,$5,$6,incoming.source_number,incoming.source_revision,incoming.source_payload
            FROM jsonb_to_recordset($7::jsonb)
              AS incoming(source_number text, source_revision integer, source_payload jsonb)
          RETURNING id
        `, [
          importId, request.authorization.projectId, request.authorization.provider,
          request.authorization.sourceProjectCode, authorization.bindingId, authorization.bindingVersion,
          JSON.stringify(rowPayload),
        ]);
            if (insertedRows.rowCount !== request.rowCount) throw new Error("RFI_IMPORT_PERSISTED_ROW_COUNT_MISMATCH");
            await client.query("COMMIT");
            return { outcome: "created", importId, rowCount: request.rowCount, digest: request.sourceDigest };
          } catch (error) {
            await rollback(client);
            const constraint = error as PgConstraintError;
            const reconcilable = constraint.code === "23505"
              && (constraint.constraint === "rfi_import_source_identity_uq"
                || constraint.constraint === "rfi_import_replay_uq");
            const retryableSerializationFailure = constraint.code === "40001";
            if ((!reconcilable && !retryableSerializationFailure) || attempt === MAX_TRANSACTION_ATTEMPTS) {
              throw error;
            }
            // Retry in a fresh SERIALIZABLE transaction. Unique conflicts are then classified
            // by replay/duplicate checks; 40001 retries re-run the complete locked decision.
          }
        }
        throw new Error("RFI_IMPORT_CONSTRAINT_RECONCILIATION_FAILED");
      } finally {
        client.release();
      }
    },
  };
}
