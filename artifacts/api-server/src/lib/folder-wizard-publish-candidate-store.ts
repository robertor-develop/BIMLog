import { FolderWizardImportError } from "./folder-wizard-import-service";
import { createRuntimeFolderWizardGraphIdentity } from "./folder-wizard-graph-identity";
import type { FolderWizardCandidateReader, FolderWizardCandidateSnapshot } from "./folder-wizard-publish-candidate";

type Client = { query(sql: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>; release(): void };
type Pool = { connect(): Promise<Client> };
type Identity = { verify(input: { companyId: number; credentialId: string; siteId: string; libraryId: string }): Promise<{ siteUrl: string; libraryId: string }> };

export function createFolderWizardPublishCandidateStore(
  database?: Pool, identity: Identity = createRuntimeFolderWizardGraphIdentity(),
  requireProjectAdmin = false,
): FolderWizardCandidateReader {
  return {
    async read(projectId: number, actorUserId: number, fileId: number): Promise<FolderWizardCandidateSnapshot> {
      const client = await (database ?? ((await import("@workspace/db")).pool as unknown as Pool)).connect();
      try {
        const authority = (await client.query(`SELECT
          COALESCE((SELECT company_id FROM project_company_binding_versions WHERE project_id=p.id ORDER BY version DESC LIMIT 1),creator.company_id) AS company_id
          FROM projects p JOIN users creator ON creator.id=p.created_by_id JOIN users actor ON actor.id=$2
          WHERE p.id=$1 AND p.status<>'archived'
            AND (actor.is_super_admin OR (actor.company_id=COALESCE((SELECT company_id FROM project_company_binding_versions WHERE project_id=p.id ORDER BY version DESC LIMIT 1),creator.company_id)
              AND EXISTS(SELECT 1 FROM project_members pm WHERE pm.project_id=p.id AND pm.user_id=actor.id AND pm.status='active'
                ${requireProjectAdmin ? "AND pm.role='project_admin'" : ""})))`,
          [projectId, actorUserId])).rows[0];
        if (!authority) throw new FolderWizardImportError("FOLDER_WIZARD_FORBIDDEN", 403);
        const companyId = Number(authority.company_id);
        const imported = (await client.query(`SELECT i.id,i.source_text FROM folder_wizard_current_imports c
          JOIN folder_wizard_imports i ON i.id=c.import_id AND i.company_id=c.company_id AND i.project_id=c.project_id
          WHERE c.company_id=$1 AND c.project_id=$2`, [companyId, projectId])).rows[0];
        const profile = (await client.query(`SELECT p.definition,p.import_id,p.scope_project_id FROM folder_wizard_current_routing_profiles c
          JOIN folder_wizard_routing_profiles p ON p.id=c.profile_id AND p.company_id=c.company_id AND p.scope_project_id=c.scope_project_id
          WHERE c.company_id=$1 AND c.scope_project_id=$2`, [companyId, projectId])).rows[0] ??
          (await client.query(`SELECT p.definition,p.import_id,p.scope_project_id FROM folder_wizard_current_routing_profiles c
          JOIN folder_wizard_routing_profiles p ON p.id=c.profile_id AND p.company_id=c.company_id AND p.scope_project_id IS NULL
          WHERE c.company_id=$1 AND c.scope_project_id IS NULL`, [companyId])).rows[0];
        const mapping = (await client.query(`SELECT m.state,m.credential_id,m.site_id,m.library_id,c.state AS credential_state
          FROM sharepoint_project_mappings m JOIN connector_credentials c ON c.id=m.credential_id AND c.company_id=m.company_id AND c.provider='sharepoint'
          WHERE m.project_id=$1 AND m.company_id=$2`, [projectId, companyId])).rows[0];
        const file = (await client.query(`SELECT id,project_id,file_name,storage_path,file_hash,file_size_bytes,status,is_compliant,is_superseded,cvr_workflow_status
          FROM files WHERE id=$1 AND project_id=$2`, [fileId, projectId])).rows[0];
        let verified: { siteUrl: string; libraryId: string } | null = null;
        let providerError: string | null = null;
        if (mapping?.state === "active" && mapping.credential_state === "active" && imported && profile) {
          try { verified = await identity.verify({ companyId, credentialId: String(mapping.credential_id),
            siteId: String(mapping.site_id), libraryId: String(mapping.library_id) }); }
          catch (error) { providerError = error instanceof Error ? error.name : "UnknownProviderError"; }
        }
        if (providerError) verified = null;
        return { importId: imported ? String(imported.id) : null, sourceText: imported ? String(imported.source_text) : null,
          profile: profile ? { definition: profile.definition, importId: profile.import_id === null ? null : String(profile.import_id),
            scope: profile.scope_project_id === null ? "company" : "project" } : null,
          mapping: mapping ? { state: String(mapping.state), credentialState: String(mapping.credential_state),
            credentialId: String(mapping.credential_id), siteId: String(mapping.site_id), libraryId: String(mapping.library_id) } : null,
          verifiedSiteUrl: verified?.siteUrl ?? null, verifiedLibraryId: verified?.libraryId ?? null,
          file: file ? { id: Number(file.id), projectId: Number(file.project_id), name: String(file.file_name),
            storageKey: file.storage_path === null ? "" : String(file.storage_path), sha256: file.file_hash === null ? "" : String(file.file_hash),
            byteSize: Number(file.file_size_bytes), status: file.is_compliant === true && file.is_superseded === false &&
              file.cvr_workflow_status !== "admin_rejected" ? String(file.status) : "rejected" } : null };
      } finally { client.release(); }
    },
  };
}
