import { pool } from "@workspace/db";
import { CoordinationConflictError, type CoordinationScope } from "./coordination-hub-service";
import type { ConnectorCredentialRecord, CoordinationHubConfigurationStore, CoordinationHubConfigurationTransaction, SharePointFolderMappingRecord, SharePointProjectMappingRecord } from "./coordination-hub-configuration-service";

type PoolClient = { query(sql: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>>; rowCount: number | null }>; release(): void };

class PostgresConfigurationTransaction implements CoordinationHubConfigurationTransaction {
  constructor(private readonly client: PoolClient) {}

  async assertProjectAdminAuthority(scope: CoordinationScope): Promise<void> {
    const result = await this.client.query(
      `SELECT 1 FROM users u JOIN projects p ON p.id=$3
       WHERE u.id=$1 AND u.company_id=$2 AND (u.is_super_admin OR EXISTS(
         SELECT 1 FROM project_members pm WHERE pm.project_id=$3 AND pm.user_id=$1 AND pm.status='active' AND pm.role='project_admin'
       ))`,
      [scope.actorUserId, scope.companyId, scope.projectId],
    );
    if (result.rowCount !== 1) throw new CoordinationConflictError("Project administrator authority is not current");
  }

  async findCredential(companyId: number, id: string): Promise<ConnectorCredentialRecord | null> {
    const result = await this.client.query(
      `SELECT id,company_id AS "companyId",provider,label,state,created_by_id AS "actorUserId",
       secret_ciphertext AS "secretCiphertext",secret_iv AS "secretIv",secret_tag AS "secretTag",wrapped_data_key AS "wrappedDataKey",wrap_iv AS "wrapIv",wrap_tag AS "wrapTag",key_version AS "keyVersion"
       FROM connector_credentials WHERE id=$1 AND company_id=$2`, [id, companyId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: String(row.id), companyId: Number(row.companyId), actorUserId: Number(row.actorUserId), provider: row.provider as ConnectorCredentialRecord["provider"], label: String(row.label), state: row.state as ConnectorCredentialRecord["state"],
      envelope: { secretCiphertext: String(row.secretCiphertext), secretIv: String(row.secretIv), secretTag: String(row.secretTag), wrappedDataKey: String(row.wrappedDataKey), wrapIv: String(row.wrapIv), wrapTag: String(row.wrapTag), keyVersion: Number(row.keyVersion) },
    };
  }

  async finalizeCredentialValidation(input: {
    scope: CoordinationScope;
    credential: Pick<ConnectorCredentialRecord, "id" | "companyId" | "provider" | "label"> & { keyVersion: number };
    valid: boolean;
    evidenceCode: string;
  }): Promise<"activated" | "rejected" | "stale"> {
    const result = await this.client.query(
      `WITH current_credential AS (
         SELECT id FROM connector_credentials
         WHERE id=$1 AND company_id=$2 AND provider=$3 AND label=$4 AND key_version=$5 AND state='pending_validation'
       ), activated AS (
         UPDATE connector_credentials SET state='active'
         WHERE $6::boolean AND id IN (SELECT id FROM current_credential)
         RETURNING id
       ), audited AS (
         INSERT INTO admin_actions_log(admin_user_id,admin_email,action,target_type,target_id,details)
         SELECT u.id,u.email,
           CASE WHEN $6::boolean THEN 'coordination_credential_activated' ELSE 'coordination_credential_validation_rejected' END,
           'connector_credential',$1,
           jsonb_build_object('provider',$3,'projectId',$7,'keyVersion',$5,'evidenceCode',$8)
         FROM users u,current_credential c WHERE u.id=$9 AND u.company_id=$2
         RETURNING target_id
       )
       SELECT EXISTS(SELECT 1 FROM current_credential) AS current, EXISTS(SELECT 1 FROM activated) AS activated, EXISTS(SELECT 1 FROM audited) AS audited`,
      [input.credential.id, input.credential.companyId, input.credential.provider, input.credential.label, input.credential.keyVersion, input.valid, input.scope.projectId, input.evidenceCode, input.scope.actorUserId],
    );
    const row = result.rows[0];
    if (!row || row.current !== true) return "stale";
    if (row.audited !== true) throw new Error("Credential validation audit could not be persisted");
    return row.activated === true ? "activated" : "rejected";
  }

  async insertPendingCredential(record: ConnectorCredentialRecord): Promise<void> {
    await this.client.query(
      `INSERT INTO connector_credentials(id,company_id,provider,label,state,secret_ciphertext,secret_iv,secret_tag,wrapped_data_key,wrap_iv,wrap_tag,key_version,created_by_id)
       VALUES($1,$2,$3,$4,'pending_validation',$5,$6,$7,$8,$9,$10,$11,$12)`,
      [record.id, record.companyId, record.provider, record.label, record.envelope.secretCiphertext, record.envelope.secretIv, record.envelope.secretTag, record.envelope.wrappedDataKey, record.envelope.wrapIv, record.envelope.wrapTag, record.envelope.keyVersion, record.actorUserId],
    );
  }

  async assertActiveSharePointCredential(companyId: number, credentialId: string): Promise<void> {
    const result = await this.client.query(`SELECT 1 FROM connector_credentials WHERE id=$1 AND company_id=$2 AND provider='sharepoint' AND state='active'`, [credentialId, companyId]);
    if (result.rowCount !== 1) throw new CoordinationConflictError("Active SharePoint credential is not authorized for this company");
  }

  async findSharePointProjectMapping(projectId: number): Promise<SharePointProjectMappingRecord | null> {
    const result = await this.client.query(
      `SELECT id,company_id AS "companyId",project_id AS "projectId",credential_id AS "credentialId",site_id AS "siteId",library_id AS "libraryId",state,created_by_id AS "actorUserId" FROM sharepoint_project_mappings WHERE project_id=$1`, [projectId],
    );
    return (result.rows[0] as unknown as SharePointProjectMappingRecord | undefined) ?? null;
  }

  async listSharePointFolderMappings(projectMappingId: string): Promise<SharePointFolderMappingRecord[]> {
    const result = await this.client.query(
      `SELECT id,project_mapping_id AS "projectMappingId",company_id AS "companyId",project_id AS "projectId",trade_id AS "tradeId",category,folder_id AS "folderId",folder_path AS "folderPath",state,created_by_id AS "actorUserId" FROM sharepoint_folder_mappings WHERE project_mapping_id=$1 ORDER BY id`, [projectMappingId],
    );
    return result.rows as unknown as SharePointFolderMappingRecord[];
  }

  async insertSharePointProjectMapping(record: SharePointProjectMappingRecord): Promise<void> {
    await this.client.query(
      `INSERT INTO sharepoint_project_mappings(id,company_id,project_id,credential_id,site_id,library_id,state,created_by_id) VALUES($1,$2,$3,$4,$5,$6,'active',$7)`,
      [record.id, record.companyId, record.projectId, record.credentialId, record.siteId, record.libraryId, record.actorUserId],
    );
  }

  async insertSharePointFolderMapping(record: SharePointFolderMappingRecord): Promise<void> {
    const result = await this.client.query(
      `INSERT INTO sharepoint_folder_mappings(id,project_mapping_id,company_id,project_id,trade_id,category,folder_id,folder_path,state,created_by_id)
       SELECT $1,$2,$3,$4,$5,$6,$7,$8,'active',$9
       WHERE $5::integer IS NULL OR EXISTS(SELECT 1 FROM enterprise_trades WHERE id=$5 AND state='active')`,
      [record.id, record.projectMappingId, record.companyId, record.projectId, record.tradeId, record.category, record.folderId, record.folderPath, record.actorUserId],
    );
    if (result.rowCount !== 1) throw new CoordinationConflictError("SharePoint folder trade is not active");
  }
}

export const postgresCoordinationHubConfigurationStore: CoordinationHubConfigurationStore = {
  async transaction<T>(work: (transaction: CoordinationHubConfigurationTransaction) => Promise<T>): Promise<T> {
    const client = await pool.connect() as unknown as PoolClient;
    try {
      await client.query("BEGIN");
      const result = await work(new PostgresConfigurationTransaction(client));
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally { client.release(); }
  },
};
