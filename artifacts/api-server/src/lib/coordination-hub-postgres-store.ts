import { pool } from "@workspace/db";
import {
  CoordinationConflictError,
  type CoordinationFileRecord,
  type CoordinationHubStore,
  type CoordinationHubTransaction,
  type CoordinationJobRecord,
  type CoordinationRevisionRecord,
  type CoordinationScope,
} from "./coordination-hub-service";

type PoolClient = {
  query(sql: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>>; rowCount: number | null }>;
  release(): void;
};

function one<T>(rows: T[]): T | null { return rows[0] ?? null; }

class PostgresCoordinationHubTransaction implements CoordinationHubTransaction {
  constructor(private readonly client: PoolClient) {}

  async assertProjectCompanyAuthority(scope: CoordinationScope): Promise<void> {
    const result = await this.client.query(
      `SELECT 1
       FROM users u
       JOIN projects p ON p.id=$3
       WHERE u.id=$1
         AND u.company_id=$2
         AND (u.is_super_admin OR EXISTS(
           SELECT 1 FROM project_members pm WHERE pm.project_id=$3 AND pm.user_id=$1
         ))`,
      [scope.actorUserId, scope.companyId, scope.projectId],
    );
    if (result.rowCount !== 1) throw new CoordinationConflictError("Project/company authority is not current");
  }

  async findFileByStableKey(projectId: number, stableKey: string): Promise<CoordinationFileRecord | null> {
    const result = await this.client.query(
      `SELECT id,project_id AS "projectId",company_id AS "companyId",stable_key AS "stableKey",category,trade_id AS "tradeId",created_by_id AS "createdById" FROM coordination_files WHERE project_id=$1 AND stable_key=$2`,
      [projectId, stableKey],
    );
    return one(result.rows as unknown as CoordinationFileRecord[]);
  }

  async insertFile(record: CoordinationFileRecord): Promise<void> {
    await this.client.query(
      `INSERT INTO coordination_files(id,company_id,project_id,trade_id,category,stable_key,created_by_id) VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [record.id, record.companyId, record.projectId, record.tradeId, record.category, record.stableKey, record.createdById],
    );
  }

  async findRevisionByProviderIdentity(provider: string, providerItemId: string, providerVersionId: string): Promise<CoordinationRevisionRecord | null> {
    const result = await this.client.query(
      `SELECT id,coordination_file_id AS "coordinationFileId",project_id AS "projectId",revision_number AS "revisionNumber",source_file_id AS "sourceFileId",provider,provider_item_id AS "providerItemId",provider_version_id AS "providerVersionId",content_sha256 AS "contentSha256",byte_size AS "byteSize",created_by_id AS "createdById" FROM coordination_file_revisions WHERE provider=$1 AND provider_item_id=$2 AND provider_version_id=$3`,
      [provider, providerItemId, providerVersionId],
    );
    return one(result.rows as unknown as CoordinationRevisionRecord[]);
  }

  async insertRevision(record: CoordinationRevisionRecord): Promise<void> {
    const result = await this.client.query(
      `INSERT INTO coordination_file_revisions(id,coordination_file_id,project_id,revision_number,source_file_id,provider,provider_item_id,provider_version_id,content_sha256,byte_size,created_by_id)
       SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
       WHERE $5::integer IS NULL OR EXISTS(SELECT 1 FROM files WHERE id=$5 AND project_id=$3)`,
      [record.id, record.coordinationFileId, record.projectId, record.revisionNumber, record.sourceFileId, record.provider, record.providerItemId, record.providerVersionId, record.contentSha256, record.byteSize, record.createdById],
    );
    if (result.rowCount !== 1) throw new CoordinationConflictError("Source file does not belong to the requested project");
  }

  async currentRevisionId(coordinationFileId: string): Promise<string | null> {
    const result = await this.client.query(`SELECT revision_id FROM coordination_file_current_revisions WHERE coordination_file_id=$1`, [coordinationFileId]);
    return typeof result.rows[0]?.revision_id === "string" ? result.rows[0].revision_id : null;
  }

  async designateCurrentRevision(input: { coordinationFileId: string; revisionId: string; expectedCurrentRevisionId: string | null; actorUserId: number }): Promise<void> {
    const result = input.expectedCurrentRevisionId === null
      ? await this.client.query(
        `INSERT INTO coordination_file_current_revisions(coordination_file_id,revision_id,designated_by_id) VALUES($1,$2,$3) ON CONFLICT(coordination_file_id) DO NOTHING`,
        [input.coordinationFileId, input.revisionId, input.actorUserId],
      )
      : await this.client.query(
        `UPDATE coordination_file_current_revisions SET revision_id=$2,designated_by_id=$3,designated_at=now() WHERE coordination_file_id=$1 AND revision_id=$4`,
        [input.coordinationFileId, input.revisionId, input.actorUserId, input.expectedCurrentRevisionId],
      );
    if (result.rowCount !== 1) throw new CoordinationConflictError("Current revision changed concurrently");
  }

  async findJobByIdempotency(input: { companyId: number; projectId: number; provider: string; jobType: string; idempotencyKey: string }): Promise<CoordinationJobRecord | null> {
    const result = await this.client.query(
      `SELECT id,credential_id AS "credentialId",company_id AS "companyId",project_id AS "projectId",provider,job_type AS "jobType",idempotency_key AS "idempotencyKey",request_digest AS "requestDigest",payload,max_attempts AS "maxAttempts",created_by_id AS "createdById" FROM connector_jobs WHERE company_id=$1 AND project_id=$2 AND provider=$3 AND job_type=$4 AND idempotency_key=$5`,
      [input.companyId, input.projectId, input.provider, input.jobType, input.idempotencyKey],
    );
    return one(result.rows as unknown as CoordinationJobRecord[]);
  }

  async insertJob(record: CoordinationJobRecord): Promise<void> {
    const result = await this.client.query(
      `INSERT INTO connector_jobs(id,credential_id,company_id,project_id,provider,job_type,idempotency_key,request_digest,payload,max_attempts,created_by_id)
       SELECT $1,c.id,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10 FROM connector_credentials c
       WHERE c.id=$11 AND c.company_id=$2 AND c.provider=$4 AND c.state='active'`,
      [record.id, record.companyId, record.projectId, record.provider, record.jobType, record.idempotencyKey, record.requestDigest, JSON.stringify(record.payload), record.maxAttempts, record.createdById, record.credentialId],
    );
    if (result.rowCount !== 1) throw new CoordinationConflictError("Active connector credential is not authorized for this company/provider");
  }
}

export const postgresCoordinationHubStore: CoordinationHubStore = {
  async transaction<T>(work: (transaction: CoordinationHubTransaction) => Promise<T>): Promise<T> {
    const client = await pool.connect() as unknown as PoolClient;
    try {
      await client.query("BEGIN");
      const result = await work(new PostgresCoordinationHubTransaction(client));
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  },
};
