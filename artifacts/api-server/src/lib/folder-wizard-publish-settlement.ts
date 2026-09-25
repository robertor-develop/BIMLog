import type { FolderWizardLease } from "./folder-wizard-publish-lease";

type Client = { query(sql: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>; release(): void };
type Pool = { connect(): Promise<Client> };
export type PublishOutcome = { kind: "completed"; itemId: string } |
  { kind: "failed"; code: string; retryable: boolean };

/** A stale worker cannot acknowledge or retry work after its lease is replaced. */
export class FolderWizardPublishSettlement {
  constructor(private readonly database: Pool) {}
  async settle(lease: FolderWizardLease, outcome: PublishOutcome): Promise<"completed" | "retry" | "dead_letter"> {
    if (!Number.isSafeInteger(lease.fencingToken) || lease.fencingToken <= 0 ||
        !/^[0-9a-f-]{36}$/.test(lease.leaseToken) ||
        outcome.kind === "completed" && (!outcome.itemId || outcome.itemId.length > 1024 || /[\x00-\x1f]/.test(outcome.itemId)) ||
        outcome.kind === "failed" && !/^FOLDER_WIZARD_[A-Z_]{1,80}$/.test(outcome.code))
      throw new Error("FOLDER_WIZARD_SETTLEMENT_INVALID");
    const client = await this.database.connect();
    try {
      await client.query("BEGIN");
      const current = (await client.query(`SELECT id,company_id,project_id,attempts,max_attempts,fencing_token
        FROM connector_jobs WHERE id=$1 AND company_id=$2 AND project_id=$3 AND provider='sharepoint'
          AND job_type='publish' AND payload->>'kind'='folder_wizard_file_v1'
          AND state='leased' AND lease_owner=$4 AND lease_token=$5 AND fencing_token=$6
          AND lease_expires_at>now() FOR UPDATE`, [lease.jobId, lease.companyId, lease.projectId,
        lease.leaseOwner, lease.leaseToken, lease.fencingToken])).rows[0];
      if (!current) throw new Error("FOLDER_WIZARD_LEASE_STALE");
      const attempts = Number(current.attempts);
      const maxAttempts = Number(current.max_attempts);
      const state = outcome.kind === "completed" ? "completed" : outcome.retryable && attempts < maxAttempts ? "retry" : "dead_letter";
      const errorCode = outcome.kind === "failed" ? outcome.code : null;
      const delaySeconds = Math.min(3600, 30 * 2 ** Math.max(0, attempts - 1));
      const updated = await client.query(`UPDATE connector_jobs SET state=$7,lease_owner=NULL,lease_token=NULL,
        lease_expires_at=NULL,updated_at=now(),last_error_code=$8,
        next_attempt_at=CASE WHEN $7='retry' THEN now()+($9::integer * interval '1 second') ELSE next_attempt_at END,
        completed_at=CASE WHEN $7='completed' THEN now() ELSE NULL END,
        dead_lettered_at=CASE WHEN $7='dead_letter' THEN now() ELSE NULL END
        WHERE id=$1 AND company_id=$2 AND project_id=$3 AND state='leased' AND lease_owner=$4
          AND lease_token=$5 AND fencing_token=$6 RETURNING id`,
      [lease.jobId, lease.companyId, lease.projectId, lease.leaseOwner, lease.leaseToken,
        lease.fencingToken, state, errorCode, delaySeconds]);
      if (updated.rowCount !== 1) throw new Error("FOLDER_WIZARD_LEASE_STALE");
      const evidence = outcome.kind === "completed" ? { itemId: outcome.itemId } : { errorCode, retryable: outcome.retryable };
      const event = await client.query(`INSERT INTO connector_job_events(id,job_id,company_id,project_id,sequence,event_type,
        from_state,to_state,fencing_token,actor_type,actor_id,reason_code,evidence)
        SELECT $1,j.id,j.company_id,j.project_id,COALESCE((SELECT max(sequence)+1 FROM connector_job_events WHERE job_id=j.id),1),
          $2,'leased',$2,j.fencing_token,'worker',$3,$4,$5::jsonb
        FROM connector_jobs j WHERE j.id=$6 AND j.company_id=$7 AND j.project_id=$8 AND j.fencing_token=$9`,
      [`${lease.jobId}:settle:${lease.fencingToken}`, state, lease.leaseOwner,
        errorCode ?? "publish_completed", JSON.stringify(evidence), lease.jobId, lease.companyId,
        lease.projectId, lease.fencingToken]);
      if (event.rowCount !== 1) throw new Error("FOLDER_WIZARD_SETTLEMENT_EVENT_FAILED");
      await client.query("COMMIT");
      return state;
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
}
