import { ConnectorValidationOperationsService, connectorValidationOperationSchema, type ConnectorValidationOperationsQuery, type ConnectorValidationOperationsStore } from "./connector-validation-operations";
import { CoordinationConflictError } from "./coordination-hub-service";

type QueryResult = { rows: Array<Record<string, unknown>>; rowCount: number | null };
type Client = { query(sql: string, values?: unknown[]): Promise<QueryResult>; release(): void };
export interface ConnectorValidationOperationsPool { connect(): Promise<Client>; }

export class PostgresConnectorValidationOperationsStore implements ConnectorValidationOperationsStore {
  constructor(private readonly database: ConnectorValidationOperationsPool) {}

  async list(input: ConnectorValidationOperationsQuery) {
    const client = await this.database.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const authority = await client.query(
        `SELECT 1 FROM users u JOIN projects p ON p.id=$3
         WHERE u.id=$1 AND u.company_id=$2 AND (u.is_super_admin OR EXISTS(
           SELECT 1 FROM project_members pm WHERE pm.project_id=$3 AND pm.user_id=$1 AND pm.status='active' AND pm.role='project_admin'
         ))`,
        [input.scope.actorUserId, input.scope.companyId, input.scope.projectId],
      );
      if (authority.rowCount !== 1) throw new CoordinationConflictError("Project administrator authority is not current");
      const result = await client.query(
        `SELECT a.target_id AS "credentialId",c.provider,c.state AS "credentialState",c.key_version AS "keyVersion",
           CASE a.action WHEN 'coordination_credential_activated' THEN 'activated' ELSE 'rejected' END AS decision,
           a.details->>'evidenceCode' AS "evidenceCode",a.admin_user_id AS "actorUserId",a.created_at AS "occurredAt"
         FROM admin_actions_log a
         JOIN connector_credentials c ON c.id=a.target_id AND c.company_id=$2 AND c.provider='sharepoint'
         WHERE a.target_type='connector_credential'
           AND a.action IN ('coordination_credential_activated','coordination_credential_validation_rejected')
           AND a.details->>'projectId'=$3::text
         ORDER BY a.created_at DESC,a.id DESC LIMIT $4`,
        [input.scope.actorUserId, input.scope.companyId, input.scope.projectId, input.limit],
      );
      const operations = result.rows.map((row) => connectorValidationOperationSchema.parse({
        credentialId: row.credentialId,
        provider: row.provider,
        credentialState: row.credentialState,
        keyVersion: Number(row.keyVersion),
        decision: row.decision,
        evidenceCode: row.evidenceCode,
        actorUserId: Number(row.actorUserId),
        occurredAt: (row.occurredAt instanceof Date ? row.occurredAt : new Date(String(row.occurredAt))).toISOString(),
      }));
      await client.query("COMMIT");
      return operations;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }
}

const runtimeStore: ConnectorValidationOperationsStore = {
  async list(input) {
    const { pool } = await import("@workspace/db");
    return new PostgresConnectorValidationOperationsStore(pool as unknown as ConnectorValidationOperationsPool).list(input);
  },
};

export const runtimeConnectorValidationOperationsService = new ConnectorValidationOperationsService(runtimeStore);
