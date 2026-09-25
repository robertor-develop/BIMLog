import { authorizeFolderWizardImport } from "./folder-wizard-import-service";

type Client = { query(sql: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>; release(): void };
type Pool = { connect(): Promise<Client> };

/** Public status is scoped to a current project member and excludes payload, tokens and provider URLs. */
export class FolderWizardPublishStatusStore {
  constructor(private readonly database: Pool) {}

  async list(scope: { projectId: number; actorUserId: number }) {
    const client = await this.database.connect();
    try {
      const companyId = await authorizeFolderWizardImport(client as never, scope, false);
      const result = await client.query(`SELECT id,state,attempts,max_attempts,last_error_code,created_at,updated_at,completed_at,
        dead_lettered_at,payload->>'filename' AS filename,payload->>'sourceFileId' AS source_file_id
        FROM connector_jobs WHERE company_id=$1 AND project_id=$2 AND provider='sharepoint' AND job_type='publish'
          AND payload->>'kind'='folder_wizard_file_v1'
        ORDER BY created_at DESC,id DESC LIMIT 25`, [companyId, scope.projectId]);
      return result.rows.map((row) => ({ jobId: String(row.id), state: String(row.state),
        attempts: Number(row.attempts), maxAttempts: Number(row.max_attempts),
        errorCode: row.last_error_code === null ? null : String(row.last_error_code),
        filename: String(row.filename), sourceFileId: Number(row.source_file_id),
        createdAt: String(row.created_at), updatedAt: String(row.updated_at),
        completedAt: row.completed_at === null ? null : String(row.completed_at),
        deadLetteredAt: row.dead_lettered_at === null ? null : String(row.dead_lettered_at) }));
    } finally { client.release(); }
  }
}

export async function createRuntimeFolderWizardPublishStatusStore() {
  const { pool } = await import("@workspace/db");
  return new FolderWizardPublishStatusStore(pool as never);
}
