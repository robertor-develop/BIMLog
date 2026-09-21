import type { KnowledgeQueryClient } from "./coordination-knowledge-repository";

export const knowledgeCapabilities = [
  "view_approved",
  "view_draft",
  "create_draft",
  "edit_draft",
  "submit_for_review",
  "review",
  "approve",
  "retire",
  "manage_taxonomy",
  "propose_lesson",
  "promote_approved_lesson",
] as const;

export type KnowledgeCapability = typeof knowledgeCapabilities[number];
export type KnowledgeAuthorizationContext = Readonly<{
  userId: number;
  companyId: number;
  isSuperAdmin: boolean;
  isCompanyPmo: boolean;
  projectId: number | null;
  projectRole: string | null;
  capabilities: ReadonlySet<KnowledgeCapability>;
}>;

export class CoordinationKnowledgeAuthorizationError extends Error {
  constructor(public readonly code: string, public readonly status: number) { super(code); }
}

const positive = (value: number, field: string): number => {
  if (!Number.isSafeInteger(value) || value <= 0) throw new CoordinationKnowledgeAuthorizationError(`${field.toUpperCase()}_INVALID`, 400);
  return value;
};

export async function resolveKnowledgeAuthorizationContext(
  client: KnowledgeQueryClient,
  userIdInput: number,
  projectIdInput?: number | null,
): Promise<KnowledgeAuthorizationContext> {
  const userId = positive(userIdInput, "user_id");
  const projectId = projectIdInput == null ? null : positive(projectIdInput, "project_id");
  const result = await client.query(`
    SELECT u.id,u.company_id,u.is_super_admin,
      EXISTS (
        SELECT 1 FROM company_master_catalog_administrators administrator
        WHERE administrator.user_id=u.id AND administrator.company_id=u.company_id AND administrator.state='active'
      ) AS is_company_pmo,
      membership.role AS project_role
    FROM users u
    LEFT JOIN LATERAL (
      SELECT member.role
      FROM project_members member
      JOIN projects project ON project.id=member.project_id
      JOIN users creator ON creator.id=project.created_by_id
      LEFT JOIN LATERAL (
        SELECT binding.company_id FROM project_company_binding_versions binding
        WHERE binding.project_id=project.id ORDER BY binding.version DESC LIMIT 1
      ) project_binding ON true
      WHERE $2::integer IS NOT NULL AND member.project_id=$2 AND member.user_id=u.id AND member.status='active'
        AND COALESCE(project_binding.company_id,creator.company_id)=u.company_id
      LIMIT 1
    ) membership ON true
    WHERE u.id=$1
    LIMIT 1`, [userId, projectId]);
  const row = result.rows[0];
  if (!row?.company_id) throw new CoordinationKnowledgeAuthorizationError("KNOWLEDGE_AUTHORITY_INVALID", 401);
  if (projectId !== null && !row.project_role && row.is_super_admin !== true) {
    throw new CoordinationKnowledgeAuthorizationError("KNOWLEDGE_PROJECT_ACCESS_DENIED", 403);
  }
  const capabilities = new Set<KnowledgeCapability>(["view_approved"]);
  const projectRole = row.project_role ? String(row.project_role) : null;
  const isSuperAdmin = row.is_super_admin === true;
  const isCompanyPmo = row.is_company_pmo === true;
  if (projectRole && projectRole !== "read_only") capabilities.add("propose_lesson");
  if (isCompanyPmo || isSuperAdmin) {
    for (const capability of knowledgeCapabilities) capabilities.add(capability);
  }
  return Object.freeze({
    userId,
    companyId: Number(row.company_id),
    isSuperAdmin,
    isCompanyPmo,
    projectId,
    projectRole,
    capabilities,
  });
}

export function requireKnowledgeCapability(context: KnowledgeAuthorizationContext, capability: KnowledgeCapability): void {
  if (!context.capabilities.has(capability)) {
    throw new CoordinationKnowledgeAuthorizationError("KNOWLEDGE_CAPABILITY_REQUIRED", 403);
  }
}
