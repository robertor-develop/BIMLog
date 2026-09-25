import type { FolderWizardPublishJob } from "./folder-wizard-publish-job";
import { isDeepStrictEqual } from "node:util";

type Client = { query(sql: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>; release(): void };
type Pool = { connect(): Promise<Client> };

/** Serialized, scoped enqueue. No provider request or file-byte deletion occurs here. */
export class FolderWizardPublishQueue {
  constructor(private readonly database: Pool) {}

  async enqueue(job: FolderWizardPublishJob): Promise<{ jobId: string; result: "queued" | "idempotent" }> {
    if (job.provider !== "sharepoint" || job.jobType !== "publish" || job.payload.kind !== "folder_wizard_file_v1" ||
        job.idempotencyKey !== job.requestDigest || !/^[a-f0-9]{64}$/.test(job.requestDigest))
      throw new Error("FOLDER_WIZARD_JOB_INVALID");
    const client = await this.database.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock($1,$2)", [job.companyId, job.projectId]);
      const authority = await client.query(`SELECT 1 FROM projects p JOIN users creator ON creator.id=p.created_by_id
        JOIN users actor ON actor.id=$3
        JOIN sharepoint_project_mappings m ON m.project_id=p.id AND m.company_id=$1 AND m.credential_id=$4
          AND m.site_id=$10 AND m.library_id=$11 AND m.state='active'
        JOIN connector_credentials c ON c.id=m.credential_id AND c.company_id=$1 AND c.provider='sharepoint' AND c.state='active'
        JOIN folder_wizard_current_imports i ON i.project_id=p.id AND i.company_id=$1 AND i.import_id=$5
        JOIN files f ON f.id=$6 AND f.project_id=p.id AND f.file_hash=$7 AND f.file_size_bytes=$8 AND f.file_name=$12
          AND f.status='active' AND f.is_compliant=true AND f.is_superseded=false AND f.cvr_workflow_status IS DISTINCT FROM 'admin_rejected'
        WHERE p.id=$2 AND p.status<>'archived'
          AND $1=COALESCE((SELECT company_id FROM project_company_binding_versions WHERE project_id=p.id ORDER BY version DESC LIMIT 1),creator.company_id)
          AND (actor.is_super_admin OR (actor.company_id=$1 AND EXISTS(SELECT 1 FROM project_members pm
            WHERE pm.project_id=p.id AND pm.user_id=actor.id AND pm.status='active' AND pm.role='project_admin')))
          AND EXISTS(SELECT 1 FROM folder_wizard_current_routing_profiles r
            JOIN folder_wizard_routing_profiles profile ON profile.id=r.profile_id AND profile.company_id=$1
            WHERE r.company_id=$1 AND r.scope_project_id IS NOT DISTINCT FROM profile.scope_project_id
              AND profile.fingerprint=$9 AND (r.scope_project_id=$2 AND profile.import_id=$5 OR
                r.scope_project_id IS NULL AND profile.import_id IS NULL AND NOT EXISTS(
                  SELECT 1 FROM folder_wizard_current_routing_profiles override WHERE override.company_id=$1 AND override.scope_project_id=$2)))`,
        [job.companyId, job.projectId, job.actorUserId, job.credentialId, job.payload.importId,
          job.payload.sourceFileId, job.payload.sourceSha256, job.payload.sourceBytes, job.payload.profileFingerprint,
          job.payload.siteId, job.payload.libraryId, job.payload.filename]);
      if (authority.rowCount !== 1) throw new Error("FOLDER_WIZARD_JOB_SOURCE_STALE");
      const inserted = await client.query(`INSERT INTO connector_jobs(id,credential_id,company_id,project_id,provider,job_type,
        idempotency_key,request_digest,payload,max_attempts,created_by_id)
        VALUES($1,$2,$3,$4,'sharepoint','publish',$5,$6,$7::jsonb,$8,$9)
        ON CONFLICT(company_id,project_id,provider,job_type,idempotency_key) DO NOTHING RETURNING id`,
        [job.id, job.credentialId, job.companyId, job.projectId, job.idempotencyKey,
          job.requestDigest, JSON.stringify(job.payload), job.maxAttempts, job.actorUserId]);
      if (inserted.rowCount === 1) {
        await client.query(`INSERT INTO connector_job_events(id,job_id,company_id,project_id,sequence,event_type,
          from_state,to_state,fencing_token,actor_type,actor_id,reason_code,evidence)
          VALUES($1,$2,$3,$4,1,'queued','none','queued',0,'user',$5,'job_enqueued',$6::jsonb)`,
        [`${job.id}:event:1`, job.id, job.companyId, job.projectId, String(job.actorUserId),
          JSON.stringify({ requestDigest: job.requestDigest, sourceFileId: job.payload.sourceFileId })]);
        await client.query("COMMIT");
        return { jobId: job.id, result: "queued" };
      }
      const existing = await client.query(`SELECT id,request_digest,payload,credential_id FROM connector_jobs
        WHERE company_id=$1 AND project_id=$2 AND provider='sharepoint' AND job_type='publish' AND idempotency_key=$3`,
      [job.companyId, job.projectId, job.idempotencyKey]);
      const row = existing.rows[0];
      if (!row || row.request_digest !== job.requestDigest || row.credential_id !== job.credentialId ||
          !isDeepStrictEqual(row.payload, job.payload)) throw new Error("FOLDER_WIZARD_JOB_IDEMPOTENCY_CONFLICT");
      await client.query("COMMIT");
      return { jobId: String(row.id), result: "idempotent" };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
}

export async function createRuntimeFolderWizardPublishQueue(): Promise<FolderWizardPublishQueue> {
  const { pool } = await import("@workspace/db");
  return new FolderWizardPublishQueue(pool as unknown as Pool);
}
