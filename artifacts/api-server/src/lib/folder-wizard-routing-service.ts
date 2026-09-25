import { randomUUID } from "node:crypto";
import { parseFolderWizardExport } from "./folder-wizard-export";
import { validateFolderWizardRoutingProfile } from "./folder-wizard-routing-contract";
import { FolderWizardImportError } from "./folder-wizard-import-service";

type Scope = { projectId: number; actorUserId: number };
type Client = { query(sql: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>; release(): void };
type Pool = { connect(): Promise<Client> };
type ProfileRow = { id: string; version: number; fingerprint: string; definition: unknown; import_id: string | null; scope_project_id: number | null };

async function authority(client: Client, scope: Scope): Promise<{ companyId: number; isPmo: boolean; isProjectAdmin: boolean }> {
  const result = await client.query(`SELECT
    COALESCE((SELECT company_id FROM project_company_binding_versions WHERE project_id=p.id ORDER BY version DESC LIMIT 1),creator.company_id) AS company_id,
    (actor.is_super_admin OR EXISTS(SELECT 1 FROM company_master_catalog_administrators a
      WHERE a.company_id=actor.company_id AND a.user_id=actor.id AND a.state='active')) AS is_pmo,
    (actor.is_super_admin OR EXISTS(SELECT 1 FROM project_members pm
      WHERE pm.project_id=p.id AND pm.user_id=actor.id AND pm.status='active' AND pm.role='project_admin')) AS is_project_admin
    FROM projects p JOIN users creator ON creator.id=p.created_by_id JOIN users actor ON actor.id=$2
    WHERE p.id=$1 AND p.status<>'archived'
      AND (actor.is_super_admin OR (actor.company_id=COALESCE((SELECT company_id FROM project_company_binding_versions WHERE project_id=p.id ORDER BY version DESC LIMIT 1),creator.company_id)
        AND EXISTS(SELECT 1 FROM project_members pm WHERE pm.project_id=p.id AND pm.user_id=actor.id AND pm.status='active')))`,
    [scope.projectId, scope.actorUserId]);
  const row = result.rows[0];
  if (!row) throw new FolderWizardImportError("FOLDER_WIZARD_FORBIDDEN", 403);
  return { companyId: Number(row.company_id), isPmo: row.is_pmo === true, isProjectAdmin: row.is_project_admin === true };
}

async function imported(client: Client, scope: Scope, companyId: number) {
  const row = (await client.query(`SELECT i.id,i.source_text,i.source_sha256 FROM folder_wizard_current_imports c
    JOIN folder_wizard_imports i ON i.id=c.import_id AND i.company_id=c.company_id AND i.project_id=c.project_id
    WHERE c.company_id=$1 AND c.project_id=$2`, [companyId, scope.projectId])).rows[0];
  if (!row) throw new FolderWizardImportError("FOLDER_WIZARD_IMPORT_REQUIRED", 409);
  return { id: String(row.id), document: parseFolderWizardExport(String(row.source_text)).document };
}

async function currentProfile(client: Client, companyId: number, scopeProjectId: number | null): Promise<ProfileRow | null> {
  const row = (await client.query(`SELECT p.id,p.version,p.fingerprint,p.definition,p.import_id,p.scope_project_id
    FROM folder_wizard_current_routing_profiles c JOIN folder_wizard_routing_profiles p ON p.id=c.profile_id
    WHERE c.company_id=$1 AND c.scope_project_id IS NOT DISTINCT FROM $2
      AND p.company_id=c.company_id AND p.scope_project_id IS NOT DISTINCT FROM c.scope_project_id`,
    [companyId, scopeProjectId])).rows[0];
  return row ? row as ProfileRow : null;
}

export function createFolderWizardRoutingService(database?: Pool) {
  const connect = async () => (database ?? ((await import("@workspace/db")).pool as unknown as Pool)).connect();
  return {
    async current(scope: Scope) {
      const client = await connect();
      try {
        const { companyId, isPmo, isProjectAdmin } = await authority(client, scope);
        const source = await imported(client, scope, companyId);
        const project = await currentProfile(client, companyId, scope.projectId);
        const company = await currentProfile(client, companyId, null);
        const profile = project ?? company;
        if (!profile) return { profile: null, scopeType: null, canEditProject: isProjectAdmin, canEditCompany: isPmo };
        const scopeType = project ? "project" : "company";
        const stale = scopeType === "project" && profile.import_id !== source.id;
        let valid = false;
        if (!stale) {
          try { validateFolderWizardRoutingProfile(profile.definition, source.document); valid = true; }
          catch { /* Existing profile is incompatible with the new import; never silently route. */ }
        }
        return { profile: { id: profile.id, version: profile.version, fingerprint: profile.fingerprint,
          definition: profile.definition, valid, stale }, scopeType, canEditProject: isProjectAdmin, canEditCompany: isPmo };
      } finally { client.release(); }
    },
    async save(scope: Scope, input: { scopeType: "company" | "project"; definition: unknown; expectedFingerprint: string | null }) {
      const client = await connect();
      try {
        await client.query("BEGIN");
        // Serialize import/profile changes against the same project row.
        await client.query("SELECT id FROM projects WHERE id=$1 FOR UPDATE", [scope.projectId]);
        const { companyId, isPmo, isProjectAdmin } = await authority(client, scope);
        if (input.scopeType === "company" ? !isPmo : !isProjectAdmin) throw new FolderWizardImportError("FOLDER_WIZARD_ROUTING_FORBIDDEN", 403);
        const source = await imported(client, scope, companyId);
        const { definition, fingerprint } = validateFolderWizardRoutingProfile(input.definition, source.document);
        const scopeProjectId = input.scopeType === "project" ? scope.projectId : null;
        const previous = await currentProfile(client, companyId, scopeProjectId);
        if ((previous?.fingerprint ?? null) !== input.expectedFingerprint) throw new FolderWizardImportError("FOLDER_WIZARD_ROUTING_STALE", 409);
        if (previous?.fingerprint === fingerprint) {
          await client.query("COMMIT");
          return { id: previous.id, version: previous.version, fingerprint, unchanged: true };
        }
        const id = randomUUID();
        const version = Number(previous?.version ?? 0) + 1;
        await client.query(`INSERT INTO folder_wizard_routing_profiles(id,company_id,scope_project_id,import_id,version,definition,fingerprint,created_by_id)
          VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8)`, [id, companyId, scopeProjectId, scopeProjectId ? source.id : null,
          version, JSON.stringify(definition), fingerprint, scope.actorUserId]);
        await client.query(`INSERT INTO folder_wizard_current_routing_profiles(id,company_id,scope_project_id,profile_id,designated_by_id)
          VALUES($1,$2,$3,$4,$5) ON CONFLICT ON CONSTRAINT folder_wizard_current_routing_scope_uq
          DO UPDATE SET profile_id=EXCLUDED.profile_id,designated_by_id=EXCLUDED.designated_by_id,designated_at=now()`,
          [randomUUID(), companyId, scopeProjectId, id, scope.actorUserId]);
        await client.query("COMMIT");
        return { id, version, fingerprint, unchanged: false };
      } catch (error) { await client.query("ROLLBACK"); throw error; }
      finally { client.release(); }
    },
  };
}
