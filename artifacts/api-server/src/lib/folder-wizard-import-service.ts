import { randomUUID } from "node:crypto";
import { parseFolderWizardExport } from "./folder-wizard-export";
import { previewFolderWizardPaths } from "./folder-wizard-paths";

export class FolderWizardImportError extends Error {
  constructor(readonly code: string, readonly status: number) { super(code); }
}

type Scope = { projectId: number; actorUserId: number };
type Client = { query(sql: string, parameters?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>; release(): void };
type Pool = { connect(): Promise<Client> };

async function authorize(client: Client, scope: Scope, write: boolean): Promise<number> {
  const result = await client.query(`
    SELECT COALESCE((SELECT company_id FROM project_company_binding_versions WHERE project_id=p.id ORDER BY version DESC LIMIT 1),creator.company_id) AS company_id
    FROM projects p JOIN users creator ON creator.id=p.created_by_id
    JOIN users actor ON actor.id=$2
    WHERE p.id=$1 AND p.status<>'archived'
      AND (actor.is_super_admin OR (actor.company_id=COALESCE((SELECT company_id FROM project_company_binding_versions WHERE project_id=p.id ORDER BY version DESC LIMIT 1),creator.company_id)
        AND EXISTS(SELECT 1 FROM project_members pm WHERE pm.project_id=p.id AND pm.user_id=actor.id AND pm.status='active'${write ? " AND pm.role='project_admin'" : ""})))`,
    [scope.projectId, scope.actorUserId],
  );
  const companyId = Number(result.rows[0]?.company_id);
  if (!Number.isInteger(companyId) || companyId <= 0) throw new FolderWizardImportError("FOLDER_WIZARD_FORBIDDEN", 403);
  return companyId;
}

export function createFolderWizardImportService(database?: Pool) {
  const connect = async () => (database ?? ((await import("@workspace/db")).pool as unknown as Pool)).connect();
  return {
    async current(scope: Scope) {
      const client = await connect();
      try {
        const companyId = await authorize(client, scope, false);
        const result = await client.query(`SELECT i.id,i.version,i.source_sha256,i.source_text,i.imported_by_id,i.imported_at
          FROM folder_wizard_current_imports c JOIN folder_wizard_imports i
            ON i.id=c.import_id AND i.project_id=c.project_id AND i.company_id=c.company_id
          WHERE c.project_id=$1 AND c.company_id=$2`, [scope.projectId, companyId]);
        const row = result.rows[0];
        if (!row) return null;
        const { document } = parseFolderWizardExport(String(row.source_text));
        return { id: row.id, version: row.version, sha256: row.source_sha256, importedById: row.imported_by_id,
          importedAt: row.imported_at, document, preview: previewFolderWizardPaths(document) };
      } finally { client.release(); }
    },
    async import(scope: Scope, sourceText: string, expectedCurrentSha256: string | null) {
      const parsed = parseFolderWizardExport(sourceText);
      const client = await connect();
      try {
        await client.query("BEGIN");
        const companyId = await authorize(client, scope, true);
        // Lock the project row so concurrent imports cannot both claim the same version.
        await client.query("SELECT id FROM projects WHERE id=$1 FOR UPDATE", [scope.projectId]);
        const current = (await client.query(`SELECT i.id,i.version,i.source_sha256 FROM folder_wizard_current_imports c
          JOIN folder_wizard_imports i ON i.id=c.import_id AND i.project_id=c.project_id AND i.company_id=c.company_id
          WHERE c.project_id=$1 AND c.company_id=$2`, [scope.projectId, companyId])).rows[0];
        if ((current?.source_sha256 ?? null) !== expectedCurrentSha256) {
          throw new FolderWizardImportError("FOLDER_WIZARD_STALE_VERSION", 409);
        }
        if (current?.source_sha256 === parsed.sha256) {
          await client.query("COMMIT");
          return { id: current.id, version: current.version, sha256: parsed.sha256, unchanged: true,
            preview: previewFolderWizardPaths(parsed.document) };
        }
        const id = randomUUID();
        const version = Number(current?.version ?? 0) + 1;
        await client.query(`INSERT INTO folder_wizard_imports(id,company_id,project_id,version,source_sha256,source_text,imported_by_id)
          VALUES($1,$2,$3,$4,$5,$6,$7)`, [id, companyId, scope.projectId, version, parsed.sha256, sourceText, scope.actorUserId]);
        await client.query(`INSERT INTO folder_wizard_current_imports(project_id,company_id,import_id,designated_by_id)
          VALUES($1,$2,$3,$4) ON CONFLICT(project_id) DO UPDATE SET company_id=EXCLUDED.company_id,
          import_id=EXCLUDED.import_id,designated_by_id=EXCLUDED.designated_by_id,designated_at=now()`,
        [scope.projectId, companyId, id, scope.actorUserId]);
        await client.query("COMMIT");
        return { id, version, sha256: parsed.sha256, unchanged: false, preview: previewFolderWizardPaths(parsed.document) };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally { client.release(); }
    },
  };
}
