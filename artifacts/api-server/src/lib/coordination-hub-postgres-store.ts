import { pool } from "@workspace/db";
import {
  CoordinationConflictError,
  type CoordinationFileRecord,
  type CoordinationHubStore,
  type CoordinationHubSummary,
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
    await this.client.query(
      `INSERT INTO connector_job_events(id,job_id,company_id,project_id,sequence,event_type,from_state,to_state,fencing_token,actor_type,actor_id,reason_code,evidence)
       VALUES($1,$2,$3,$4,1,'queued','none','queued',0,'user',$5,'job_enqueued',$6::jsonb)`,
      [
        `${record.id}:event:1`,
        record.id,
        record.companyId,
        record.projectId,
        String(record.createdById),
        JSON.stringify({ provider: record.provider, jobType: record.jobType, requestDigest: record.requestDigest }),
      ],
    );
  }

  async readSummary(scope: CoordinationScope): Promise<CoordinationHubSummary> {
    const countsResult = await this.client.query(
      `SELECT
         (SELECT count(*) FROM coordination_files WHERE company_id=$1 AND project_id=$2) AS files,
         (SELECT count(*) FROM coordination_file_revisions r JOIN coordination_files f ON f.id=r.coordination_file_id WHERE f.company_id=$1 AND f.project_id=$2) AS revisions,
         (SELECT count(*) FROM coordination_file_current_revisions c JOIN coordination_files f ON f.id=c.coordination_file_id WHERE f.company_id=$1 AND f.project_id=$2) AS "currentFiles",
         (SELECT count(*) FROM connector_jobs WHERE company_id=$1 AND project_id=$2 AND state IN ('queued','leased','retry')) AS "activeJobs",
         (SELECT count(*) FROM connector_jobs WHERE company_id=$1 AND project_id=$2 AND state='dead_letter') AS "attentionJobs",
         (SELECT count(*) FROM connector_credentials WHERE company_id=$1 AND state='active') AS "activeCredentials",
         current_timestamp AS "observedAt"`,
      [scope.companyId, scope.projectId],
    );
    const filesResult = await this.client.query(
      `SELECT f.id,f.stable_key AS "stableKey",f.category,c.revision_id AS "currentRevisionId",r.revision_number AS "currentRevisionNumber",r.provider,f.created_at AS "createdAt"
       FROM coordination_files f
       LEFT JOIN coordination_file_current_revisions c ON c.coordination_file_id=f.id
       LEFT JOIN coordination_file_revisions r ON r.id=c.revision_id AND r.coordination_file_id=f.id
       WHERE f.company_id=$1 AND f.project_id=$2
       ORDER BY f.created_at DESC,f.id ASC LIMIT 20`,
      [scope.companyId, scope.projectId],
    );
    const jobsResult = await this.client.query(
      `SELECT id,provider,job_type AS "jobType",state,attempts,max_attempts AS "maxAttempts",created_at AS "createdAt",updated_at AS "updatedAt"
       FROM connector_jobs WHERE company_id=$1 AND project_id=$2
       ORDER BY created_at DESC,id ASC LIMIT 20`,
      [scope.companyId, scope.projectId],
    );
    const counts = countsResult.rows[0] ?? {};
    const iso = (value: unknown): string => {
      const date = value instanceof Date ? value : new Date(String(value));
      if (Number.isNaN(date.valueOf())) throw new Error("Coordination summary timestamp is invalid");
      return date.toISOString();
    };
    return {
      projectId: scope.projectId,
      observedAt: iso(counts.observedAt),
      counts: {
        files: Number(counts.files),
        revisions: Number(counts.revisions),
        currentFiles: Number(counts.currentFiles),
        activeJobs: Number(counts.activeJobs),
        attentionJobs: Number(counts.attentionJobs),
        activeCredentials: Number(counts.activeCredentials),
      },
      latestFiles: filesResult.rows.map((row) => ({
        id: String(row.id), stableKey: String(row.stableKey), category: String(row.category),
        currentRevisionId: row.currentRevisionId == null ? null : String(row.currentRevisionId),
        currentRevisionNumber: row.currentRevisionNumber == null ? null : Number(row.currentRevisionNumber),
        provider: row.provider == null ? null : String(row.provider), createdAt: iso(row.createdAt),
      })),
      recentJobs: jobsResult.rows.map((row) => ({
        id: String(row.id), provider: String(row.provider), jobType: String(row.jobType), state: String(row.state),
        attempts: Number(row.attempts), maxAttempts: Number(row.maxAttempts), createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt),
      })),
    };
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
  async readTransaction<T>(work: (transaction: CoordinationHubTransaction) => Promise<T>): Promise<T> {
    const client = await pool.connect() as unknown as PoolClient;
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
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
