import { randomUUID } from "node:crypto";

type Client = { query(sql: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>; release(): void };
type Pool = { connect(): Promise<Client> };
export type FolderWizardLease = { jobId: string; companyId: number; projectId: number; credentialId: string;
  createdById: number; requestDigest: string; leaseOwner: string; leaseToken: string;
  fencingToken: number; attempts: number; payload: Record<string, unknown> };

/** Claims only this exact job kind. Expired leases get a new fencing token. */
export const CLAIM_FOLDER_WIZARD_PUBLISH_SQL = `WITH candidate AS (
  SELECT id,state FROM connector_jobs
  WHERE provider='sharepoint' AND job_type='publish' AND payload->>'kind'='folder_wizard_file_v1'
    AND ($3::text IS NULL OR id=$3)
    AND attempts<max_attempts AND (
      state IN ('queued','retry') AND next_attempt_at<=now() OR
      state='leased' AND lease_expires_at<now())
  ORDER BY next_attempt_at,created_at,id FOR UPDATE SKIP LOCKED LIMIT 1
), updated AS (
  UPDATE connector_jobs j SET state='leased',lease_owner=$1,lease_token=$2,
    lease_expires_at=now()+interval '2 minutes',fencing_token=j.fencing_token+1,
    attempts=j.attempts+1,updated_at=now()
  FROM candidate WHERE j.id=candidate.id
  RETURNING j.id,j.company_id,j.project_id,j.credential_id,j.created_by_id,j.request_digest,j.lease_owner,j.lease_token,
    j.fencing_token,j.attempts,j.payload,candidate.state AS previous_state
) SELECT * FROM updated`;

export class FolderWizardPublishLeaseStore {
  constructor(private readonly database: Pool) {}
  async claim(leaseOwner: string, jobId: string | null = null): Promise<FolderWizardLease | null> {
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(leaseOwner)) throw new Error("FOLDER_WIZARD_LEASE_OWNER_INVALID");
    if (jobId !== null && !/^[a-zA-Z0-9_-]{8,128}$/.test(jobId)) throw new Error("FOLDER_WIZARD_JOB_ID_INVALID");
    const token = randomUUID();
    const client = await this.database.connect();
    try {
      await client.query("BEGIN");
      const row = (await client.query(CLAIM_FOLDER_WIZARD_PUBLISH_SQL, [leaseOwner, token, jobId])).rows[0];
      if (!row) { await client.query("COMMIT"); return null; }
      const event = await client.query(`INSERT INTO connector_job_events(id,job_id,company_id,project_id,sequence,event_type,
        from_state,to_state,fencing_token,actor_type,actor_id,reason_code,evidence)
        SELECT $1,j.id,j.company_id,j.project_id,COALESCE((SELECT max(sequence)+1 FROM connector_job_events WHERE job_id=j.id),1),
          'leased',$2,'leased',j.fencing_token,'worker',$3,'lease_claimed','{}'::jsonb
        FROM connector_jobs j WHERE j.id=$4 AND j.lease_token=$5 AND j.fencing_token=$6`,
      [`${String(row.id)}:lease:${Number(row.fencing_token)}`, String(row.previous_state), leaseOwner,
        String(row.id), token, Number(row.fencing_token)]);
      if (event.rowCount !== 1) throw new Error("FOLDER_WIZARD_LEASE_EVENT_FAILED");
      await client.query("COMMIT");
      return { jobId: String(row.id), companyId: Number(row.company_id), projectId: Number(row.project_id),
        credentialId: String(row.credential_id), createdById: Number(row.created_by_id),
        requestDigest: String(row.request_digest), leaseOwner, leaseToken: token,
        fencingToken: Number(row.fencing_token), attempts: Number(row.attempts),
        payload: row.payload as Record<string, unknown> };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
}
