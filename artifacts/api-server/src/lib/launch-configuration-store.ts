import { createHash, randomUUID } from "node:crypto";
type QueryResult = { rows: any[]; rowCount?: number | null };
type Queryable = { query(sql: string, values?: unknown[]): Promise<QueryResult> };
type TransactionClient = Queryable & { release(): void };
type TransactionPool = { connect(): Promise<TransactionClient> };

export type LaunchEnvironment = "development" | "staging" | "production";
export type LaunchStoredState = "draft" | "validated" | "active" | "inactive";
export type LaunchConfigurationSnapshot = Readonly<{ id: string; environment: LaunchEnvironment; revision: number; state: LaunchStoredState; configuration: unknown; readiness: unknown; updatedAt: string }>;

export class LaunchConfigurationConflict extends Error { constructor() { super("Launch configuration changed; reload before saving again."); } }

export function launchConfigurationFingerprint(input: { environment: string; revision: number; state: string; configuration: unknown; readiness: unknown }) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

const projection = `id,environment,revision,state,configuration,readiness,updated_at AS "updatedAt"`;
const map = (row: any): LaunchConfigurationSnapshot => Object.freeze({ ...row, revision: Number(row.revision), updatedAt: new Date(row.updatedAt).toISOString() });

export async function readLaunchConfiguration(pool: Queryable, environment: LaunchEnvironment) {
  const result = await pool.query(`SELECT ${projection} FROM launch_configurations WHERE environment=$1`, [environment]);
  return result.rows[0] ? map(result.rows[0]) : null;
}

export async function writeLaunchConfiguration(pool: TransactionPool, input: {
  environment: LaunchEnvironment; expectedRevision: number; state: LaunchStoredState; configuration: unknown; readiness: unknown;
  actorUserId: number; reason: string; action?: "updated" | "activated" | "deactivated" | "restored";
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query(`SELECT ${projection} FROM launch_configurations WHERE environment=$1 FOR UPDATE`, [input.environment]);
    const prior = current.rows[0] ? map(current.rows[0]) : null;
    if ((prior?.revision ?? 0) !== input.expectedRevision) throw new LaunchConfigurationConflict();
    const id = prior?.id ?? randomUUID(), revision = input.expectedRevision + 1, action = prior ? (input.action ?? "updated") : "created";
    const values = [id, input.environment, revision, input.state, JSON.stringify(input.configuration), JSON.stringify(input.readiness), input.actorUserId];
    const saved = prior
      ? await client.query(`UPDATE launch_configurations SET revision=$3,state=$4,configuration=$5::jsonb,readiness=$6::jsonb,updated_by_user_id=$7,updated_at=now() WHERE id=$1 AND environment=$2 RETURNING ${projection}`, values)
      : await client.query(`INSERT INTO launch_configurations(id,environment,revision,state,configuration,readiness,created_by_user_id,updated_by_user_id) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$7) RETURNING ${projection}`, values);
    if (saved.rowCount !== 1) throw new LaunchConfigurationConflict();
    const fingerprint = launchConfigurationFingerprint({ environment: input.environment, revision, state: input.state, configuration: input.configuration, readiness: input.readiness });
    await appendHistory(client, { id, environment: input.environment, revision, state: input.state, configuration: input.configuration, readiness: input.readiness, actorUserId: input.actorUserId, reason: input.reason, action, fingerprint });
    await client.query("COMMIT");
    return map(saved.rows[0]);
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

async function appendHistory(client: Queryable, input: { id: string; environment: string; revision: number; state: string; configuration: unknown; readiness: unknown; actorUserId: number; reason: string; action: string; fingerprint: string }) {
  await client.query(`INSERT INTO launch_configuration_versions(id,configuration_id,environment,revision,state,configuration,readiness,reason,actor_user_id) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9)`, [randomUUID(), input.id, input.environment, input.revision, input.state, JSON.stringify(input.configuration), JSON.stringify(input.readiness), input.reason, input.actorUserId]);
  await client.query(`INSERT INTO launch_configuration_audit(id,configuration_id,environment,revision,action,actor_user_id,reason,fingerprint) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [randomUUID(), input.id, input.environment, input.revision, input.action, input.actorUserId, input.reason, input.fingerprint]);
}

export async function listLaunchConfigurationHistory(pool: Queryable, environment: LaunchEnvironment) {
  const result = await pool.query(`SELECT id,revision,state,reason,actor_user_id AS "actorUserId",created_at AS "createdAt" FROM launch_configuration_versions WHERE environment=$1 ORDER BY revision DESC`, [environment]);
  return result.rows;
}
