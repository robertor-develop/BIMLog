import { CoordinationConflictError } from "./coordination-hub-service";
import {
  ConnectorCredentialLifecycleService,
  connectorCredentialLifecycleEventSchema,
  connectorCredentialLifecycleRecordSchema,
  type ConnectorCredentialLifecycleQuery,
  type ConnectorCredentialLifecycleStore,
} from "./connector-credential-lifecycle";

type QueryResult = { rows: Array<Record<string, unknown>>; rowCount: number | null };
type Client = { query(sql: string, values?: unknown[]): Promise<QueryResult>; release(): void };
export interface ConnectorCredentialLifecyclePool { connect(): Promise<Client>; }

function iso(value: unknown): string {
  return (value instanceof Date ? value : new Date(String(value))).toISOString();
}

function positiveOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  return Number(value);
}

export class PostgresConnectorCredentialLifecycleStore implements ConnectorCredentialLifecycleStore {
  constructor(private readonly database: ConnectorCredentialLifecyclePool) {}

  async read(input: ConnectorCredentialLifecycleQuery) {
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

      const credentialsResult = await client.query(
        `WITH project_credentials AS (
           SELECT credential_id AS id FROM sharepoint_project_mappings
           WHERE project_id=$2 AND company_id=$1
           UNION
           SELECT target_id AS id FROM admin_actions_log
           WHERE target_type='connector_credential'
             AND action IN ('coordination_credential_activated','coordination_credential_validation_rejected','coordination_credential_rotated_pending_validation')
             AND details->>'projectId'=$2::text
         )
         SELECT c.id AS "credentialId",c.provider,c.label,c.state,c.key_version AS "keyVersion",
           c.created_by_id AS "createdByUserId",c.created_at AS "enrolledAt",
           EXISTS(SELECT 1 FROM sharepoint_project_mappings m WHERE m.project_id=$2 AND m.company_id=$1 AND m.credential_id=c.id) AS "mappedToProject"
         FROM connector_credentials c JOIN project_credentials pc ON pc.id=c.id
         WHERE c.company_id=$1 AND c.provider='sharepoint'
         ORDER BY c.created_at DESC,c.id ASC LIMIT $3`,
        [input.scope.companyId, input.scope.projectId, input.credentialLimit],
      );

      const eventsResult = await client.query(
        `WITH project_credentials AS (
           SELECT credential_id AS id FROM sharepoint_project_mappings
           WHERE project_id=$2 AND company_id=$1
           UNION
           SELECT target_id AS id FROM admin_actions_log
           WHERE target_type='connector_credential'
             AND action IN ('coordination_credential_activated','coordination_credential_validation_rejected','coordination_credential_rotated_pending_validation')
             AND details->>'projectId'=$2::text
         ), lifecycle_events AS (
           SELECT 'enrolled'::text AS event,c.id AS credential_id,c.created_by_id AS actor_user_id,c.created_at AS occurred_at,
             NULL::text AS previous_key_version,NULL::text AS key_version,NULL::text AS evidence_code
           FROM connector_credentials c JOIN project_credentials pc ON pc.id=c.id
           WHERE c.company_id=$1 AND c.provider='sharepoint'
           UNION ALL
           SELECT CASE a.action
               WHEN 'coordination_credential_activated' THEN 'activated'
               WHEN 'coordination_credential_validation_rejected' THEN 'validation_rejected'
               ELSE 'rotated_pending_validation'
             END,
             a.target_id,a.admin_user_id,a.created_at,
             a.details->>'previousKeyVersion',a.details->>'keyVersion',a.details->>'evidenceCode'
           FROM admin_actions_log a
           JOIN connector_credentials c ON c.id=a.target_id AND c.company_id=$1 AND c.provider='sharepoint'
           WHERE a.target_type='connector_credential'
             AND a.action IN ('coordination_credential_activated','coordination_credential_validation_rejected','coordination_credential_rotated_pending_validation')
             AND a.details->>'projectId'=$2::text
         )
         SELECT event,credential_id AS "credentialId",actor_user_id AS "actorUserId",occurred_at AS "occurredAt",
           previous_key_version AS "previousKeyVersion",key_version AS "keyVersion",evidence_code AS "evidenceCode"
         FROM lifecycle_events ORDER BY occurred_at DESC,credential_id ASC,event ASC LIMIT $3`,
        [input.scope.companyId, input.scope.projectId, input.eventLimit],
      );

      const credentials = credentialsResult.rows.map((row) => connectorCredentialLifecycleRecordSchema.parse({
        credentialId: row.credentialId,
        provider: row.provider,
        label: row.label,
        state: row.state,
        keyVersion: Number(row.keyVersion),
        createdByUserId: Number(row.createdByUserId),
        enrolledAt: iso(row.enrolledAt),
        mappedToProject: row.mappedToProject,
      }));
      const events = eventsResult.rows.map((row) => connectorCredentialLifecycleEventSchema.parse({
        event: row.event,
        credentialId: row.credentialId,
        actorUserId: Number(row.actorUserId),
        occurredAt: iso(row.occurredAt),
        previousKeyVersion: positiveOrNull(row.previousKeyVersion),
        keyVersion: positiveOrNull(row.keyVersion),
        evidenceCode: row.evidenceCode ?? null,
      }));
      await client.query("COMMIT");
      return { credentials, events };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }
}

const runtimeStore: ConnectorCredentialLifecycleStore = {
  async read(input) {
    const { pool } = await import("@workspace/db");
    return new PostgresConnectorCredentialLifecycleStore(pool as unknown as ConnectorCredentialLifecyclePool).read(input);
  },
};

export const runtimeConnectorCredentialLifecycleService = new ConnectorCredentialLifecycleService(runtimeStore);
