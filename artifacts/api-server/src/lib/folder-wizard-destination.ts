import { randomUUID } from "node:crypto";
import { z } from "zod/v4";
import { FolderWizardImportError } from "./folder-wizard-import-service";
import { createRuntimeFolderWizardGraphIdentity } from "./folder-wizard-graph-identity";

type Scope = { projectId: number; actorUserId: number };
type Client = { query(sql: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>; release(): void };
type Pool = { connect(): Promise<Client> };
type Identity = { verify(input: { companyId: number; credentialId: string; siteId: string; libraryId: string }): Promise<{ siteUrl: string; libraryId: string }> };
const identifier = z.string().trim().min(1).max(1024).regex(/^[^\x00-\x1f]+$/);
const inputSchema = z.object({ credentialId: identifier, siteId: identifier, libraryId: identifier,
  confirmation: z.literal("configure_sharepoint_destination") }).strict();

async function authority(client: Client, scope: Scope) {
  const row = (await client.query(`SELECT COALESCE((SELECT company_id FROM project_company_binding_versions
      WHERE project_id=p.id ORDER BY version DESC LIMIT 1),creator.company_id) AS company_id,actor.is_super_admin,
    EXISTS(SELECT 1 FROM project_members pm WHERE pm.project_id=p.id AND pm.user_id=actor.id
      AND pm.status='active' AND pm.role='project_admin') AS project_admin
    FROM projects p JOIN users actor ON actor.id=$2 JOIN users creator ON creator.id=p.created_by_id
    WHERE p.id=$1 AND p.status<>'archived'
      AND (actor.is_super_admin OR (actor.company_id=COALESCE((SELECT company_id FROM project_company_binding_versions
        WHERE project_id=p.id ORDER BY version DESC LIMIT 1),creator.company_id)
      AND EXISTS(SELECT 1 FROM project_members pm
        WHERE pm.project_id=p.id AND pm.user_id=actor.id AND pm.status='active')))`, [scope.projectId, scope.actorUserId])).rows[0];
  if (!row) throw new FolderWizardImportError("FOLDER_WIZARD_FORBIDDEN", 403);
  return { companyId: Number(row.company_id), canConfigure: row.is_super_admin === true || row.project_admin === true };
}

async function mapping(client: Client, scope: Scope, companyId: number) {
  return (await client.query(`SELECT id,credential_id AS "credentialId",site_id AS "siteId",library_id AS "libraryId",state
    FROM sharepoint_project_mappings WHERE project_id=$1 AND company_id=$2`, [scope.projectId, companyId])).rows[0] ?? null;
}

/** Uses the existing canonical mapping; never enrolls or replaces credentials. */
export function createFolderWizardDestinationStore(database?: Pool, identity: Identity = createRuntimeFolderWizardGraphIdentity()) {
  const connect = async () => (database ?? ((await import("@workspace/db")).pool as unknown as Pool)).connect();
  return {
    async read(scope: Scope) {
      const client = await connect();
      try {
        const access = await authority(client, scope);
        const current = await mapping(client, scope, access.companyId);
        const credentials = access.canConfigure ? (await client.query(`SELECT id,label FROM connector_credentials
          WHERE company_id=$1 AND provider='sharepoint' AND state='active' ORDER BY label,id`, [access.companyId])).rows : [];
        return { canConfigure: access.canConfigure, current, credentials };
      } finally { client.release(); }
    },
    async create(scope: Scope, raw: unknown) {
      const input = inputSchema.parse(raw);
      const client = await connect();
      let transaction = false;
      try {
        const access = await authority(client, scope);
        if (!access.canConfigure) throw new FolderWizardImportError("FOLDER_WIZARD_FORBIDDEN", 403);
        const verified = await identity.verify({ ...input, companyId: access.companyId });
        if (verified.libraryId !== input.libraryId) throw new FolderWizardImportError("FOLDER_WIZARD_DESTINATION_UNVERIFIED", 400);
        await client.query("BEGIN"); transaction = true;
        await client.query("SELECT id FROM projects WHERE id=$1 FOR UPDATE", [scope.projectId]);
        const fresh = await authority(client, scope);
        if (!fresh.canConfigure || fresh.companyId !== access.companyId) throw new FolderWizardImportError("FOLDER_WIZARD_FORBIDDEN", 403);
        const credential = (await client.query(`SELECT id FROM connector_credentials
          WHERE id=$1 AND company_id=$2 AND provider='sharepoint' AND state='active' FOR SHARE`, [input.credentialId, fresh.companyId])).rows[0];
        if (!credential) throw new FolderWizardImportError("FOLDER_WIZARD_DESTINATION_UNVERIFIED", 409);
        const existing = await mapping(client, scope, fresh.companyId);
        if (existing) {
          if (existing.credentialId !== input.credentialId || existing.siteId !== input.siteId || existing.libraryId !== input.libraryId || existing.state !== "active")
            throw new FolderWizardImportError("FOLDER_WIZARD_DESTINATION_CONFLICT", 409);
          await client.query("COMMIT"); transaction = false;
          return { result: "idempotent", mappingId: existing.id };
        }
        const mappingId = randomUUID();
        await client.query(`INSERT INTO sharepoint_project_mappings(id,company_id,project_id,credential_id,site_id,library_id,state,created_by_id)
          VALUES($1,$2,$3,$4,$5,$6,'active',$7)`, [mappingId, fresh.companyId, scope.projectId, input.credentialId, input.siteId, input.libraryId, scope.actorUserId]);
        await client.query(`INSERT INTO admin_actions_log(admin_user_id,admin_email,action,target_type,target_id,details)
          SELECT id,email,'sharepoint_destination_configured','project',$1::text,jsonb_build_object('mappingId',$3::text)
          FROM users WHERE id=$2`, [scope.projectId, scope.actorUserId, mappingId]);
        await client.query("COMMIT"); transaction = false;
        return { result: "created", mappingId };
      } catch (error) {
        if (transaction) await client.query("ROLLBACK");
        throw error;
      } finally { client.release(); }
    },
  };
}
