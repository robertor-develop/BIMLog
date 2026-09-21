import { randomUUID } from "node:crypto";
import {
  CoordinationKnowledgeContractError,
  type ConflictTypeRevision,
  type CoordinationRuleRevision,
  type ResolutionMethodRevision,
  validateConflictTypeRevision,
  validateCoordinationRuleRevision,
  validateResolutionMethodRevision,
} from "./coordination-knowledge-contract";

type QueryResult = { rows: Array<Record<string, unknown>>; rowCount?: number | null };
export type KnowledgeQueryClient = { query(sql: string, params?: unknown[]): Promise<QueryResult> };
export type KnowledgeRepositoryPool = KnowledgeQueryClient & {
  connect(): Promise<KnowledgeQueryClient & { release(): void }>;
};

export class CoordinationKnowledgeRepositoryError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) { super(message); }
}

function positive(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new CoordinationKnowledgeRepositoryError("KNOWLEDGE_SCOPE_INVALID", `${field} must be a positive integer.`);
  return value;
}
function postgresCode(error: unknown): string | undefined { return error && typeof error === "object" ? String((error as { code?: unknown }).code ?? "") : undefined; }
function mapWriteError(error: unknown): never {
  if (error instanceof CoordinationKnowledgeRepositoryError || error instanceof CoordinationKnowledgeContractError) throw error;
  if (postgresCode(error) === "23505") throw new CoordinationKnowledgeRepositoryError("KNOWLEDGE_DUPLICATE", "An organization knowledge record with the same identity already exists.", 409);
  if (postgresCode(error) === "23503") throw new CoordinationKnowledgeRepositoryError("KNOWLEDGE_REFERENCE_INVALID", "A referenced knowledge, project, issue, user, or evidence record is unavailable in this scope.", 409);
  throw error;
}

async function transaction<T>(pool: KnowledgeRepositoryPool, work: (client: KnowledgeQueryClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    mapWriteError(error);
  } finally {
    client.release();
  }
}

export class CoordinationKnowledgeRepository {
  constructor(private readonly pool: KnowledgeRepositoryPool) {}

  async getConflictType(companyIdInput: number, conflictTypeId: string, includeRetired = true): Promise<Record<string, unknown> | null> {
    const companyId = positive(companyIdInput, "companyId");
    const result = await this.pool.query(`
      SELECT t.id,t.company_id,t.code,t.created_by_id,t.created_at,t.updated_at,
             r.id revision_id,r.revision,r.status,r.name,r.description,r.discipline_a,r.discipline_b,
             r.element_type_a,r.element_type_b,r.conflict_category,r.coordination_stage,r.tags,
             r.authored_by_id,r.approved_by_id,r.approved_at,r.retired_by_id,r.retired_at,r.created_at revision_created_at
      FROM coordination_conflict_types t
      JOIN LATERAL (
        SELECT * FROM coordination_conflict_type_revisions candidate
        WHERE candidate.conflict_type_id=t.id AND candidate.company_id=t.company_id
          AND ($3::boolean OR candidate.status<>'retired')
        ORDER BY candidate.revision DESC LIMIT 1
      ) r ON true
      WHERE t.id=$1 AND t.company_id=$2`, [conflictTypeId, companyId, includeRetired]);
    return result.rows[0] ?? null;
  }

  async listApprovedRules(companyIdInput: number): Promise<Array<Record<string, unknown>>> {
    const companyId = positive(companyIdInput, "companyId");
    const result = await this.pool.query(`
      SELECT r.*,base.code FROM coordination_rule_revisions r
      JOIN coordination_rules base ON base.id=r.rule_id AND base.company_id=r.company_id
      WHERE r.company_id=$1 AND r.status='approved'
      ORDER BY base.code,r.revision DESC`, [companyId]);
    return result.rows;
  }

  async listResolutionMethodsForConflictType(companyIdInput: number, conflictTypeId: string, includeRetired = false): Promise<Array<Record<string, unknown>>> {
    const companyId = positive(companyIdInput, "companyId");
    const result = await this.pool.query(`
      SELECT revision.*,base.code,link.display_order
      FROM coordination_resolution_method_conflict_types link
      JOIN coordination_resolution_method_revisions revision
        ON revision.id=link.resolution_method_revision_id AND revision.company_id=link.company_id
      JOIN coordination_resolution_methods base
        ON base.id=revision.resolution_method_id AND base.company_id=revision.company_id
      WHERE link.company_id=$1 AND link.conflict_type_id=$2
        AND ($3::boolean OR revision.status<>'retired')
      ORDER BY link.display_order,base.code,revision.revision DESC`, [companyId, conflictTypeId, includeRetired]);
    return result.rows;
  }

  async createConflictType(input: { identity: { id: string; companyId: number; code: string; createdById: number }; revision: ConflictTypeRevision }): Promise<void> {
    const revision = validateConflictTypeRevision(input.revision);
    if (input.identity.id !== revision.conflictTypeId || input.identity.companyId !== revision.companyId || revision.revision !== 1 || revision.status !== "draft") {
      throw new CoordinationKnowledgeRepositoryError("KNOWLEDGE_IDENTITY_MISMATCH", "The first Conflict Type revision must be a draft in the same organization scope.");
    }
    await transaction(this.pool, async client => {
      await client.query(`INSERT INTO coordination_conflict_types(id,company_id,code,created_by_id) VALUES($1,$2,$3,$4)`, [input.identity.id, input.identity.companyId, input.identity.code, input.identity.createdById]);
      await client.query(`INSERT INTO coordination_conflict_type_revisions(id,conflict_type_id,company_id,revision,status,name,description,discipline_a,discipline_b,element_type_a,element_type_b,conflict_category,coordination_stage,tags,authored_by_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15)`, [revision.id, revision.conflictTypeId, revision.companyId, revision.revision, revision.status, revision.name, revision.description, revision.disciplineA, revision.disciplineB, revision.elementTypeA, revision.elementTypeB, revision.conflictCategory, revision.coordinationStage, JSON.stringify(revision.tags), revision.authoredById]);
      await client.query(`INSERT INTO coordination_knowledge_events(id,company_id,entity_type,entity_id,revision_id,action,actor_id,details) VALUES($1,$2,'conflict_type',$3,$4,'created',$5,'{}'::jsonb)`, [randomUUID(), revision.companyId, revision.conflictTypeId, revision.id, revision.authoredById]);
    });
  }

  async createRule(input: { identity: { id: string; companyId: number; code: string; createdById: number }; revision: CoordinationRuleRevision }): Promise<void> {
    const revision = validateCoordinationRuleRevision(input.revision);
    if (input.identity.id !== revision.ruleId || input.identity.companyId !== revision.companyId || revision.revision !== 1 || revision.status !== "draft") {
      throw new CoordinationKnowledgeRepositoryError("KNOWLEDGE_IDENTITY_MISMATCH", "The first Coordination Rule revision must be a draft in the same organization scope.");
    }
    await transaction(this.pool, async client => {
      await client.query(`INSERT INTO coordination_rules(id,company_id,code,created_by_id) VALUES($1,$2,$3,$4)`, [input.identity.id, input.identity.companyId, input.identity.code, input.identity.createdById]);
      await client.query(`INSERT INTO coordination_rule_revisions(id,rule_id,company_id,revision,status,title,guidance,applicability,rationale,exceptions,"references",authored_by_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::jsonb,$11::jsonb,$12)`, [revision.id, revision.ruleId, revision.companyId, revision.revision, revision.status, revision.title, revision.guidance, JSON.stringify(revision.applicability), revision.rationale, JSON.stringify(revision.exceptions), JSON.stringify(revision.references), revision.authoredById]);
      await client.query(`INSERT INTO coordination_knowledge_events(id,company_id,entity_type,entity_id,revision_id,action,actor_id,details) VALUES($1,$2,'coordination_rule',$3,$4,'created',$5,'{}'::jsonb)`, [randomUUID(), revision.companyId, revision.ruleId, revision.id, revision.authoredById]);
    });
  }

  async createResolutionMethod(input: { identity: { id: string; companyId: number; code: string; createdById: number }; revision: ResolutionMethodRevision }): Promise<void> {
    const revision = validateResolutionMethodRevision(input.revision);
    if (input.identity.id !== revision.resolutionMethodId || input.identity.companyId !== revision.companyId || revision.revision !== 1 || revision.status !== "draft") {
      throw new CoordinationKnowledgeRepositoryError("KNOWLEDGE_IDENTITY_MISMATCH", "The first Resolution Method revision must be a draft in the same organization scope.");
    }
    await transaction(this.pool, async client => {
      const conflicts = await client.query(`SELECT id FROM coordination_conflict_types WHERE company_id=$1 AND id=ANY($2::text[])`, [revision.companyId, revision.conflictTypeIds]);
      if (conflicts.rows.length !== revision.conflictTypeIds.length) throw new CoordinationKnowledgeRepositoryError("KNOWLEDGE_CROSS_TENANT_REFERENCE", "Every Conflict Type must belong to the Resolution Method organization.", 403);
      if (revision.ruleRevisionIds.length) {
        const rules = await client.query(`SELECT id FROM coordination_rule_revisions WHERE company_id=$1 AND id=ANY($2::text[])`, [revision.companyId, revision.ruleRevisionIds]);
        if (rules.rows.length !== revision.ruleRevisionIds.length) throw new CoordinationKnowledgeRepositoryError("KNOWLEDGE_CROSS_TENANT_REFERENCE", "Every Coordination Rule revision must belong to the Resolution Method organization.", 403);
      }
      await client.query(`INSERT INTO coordination_resolution_methods(id,company_id,code,created_by_id) VALUES($1,$2,$3,$4)`, [input.identity.id, input.identity.companyId, input.identity.code, input.identity.createdById]);
      await client.query(`INSERT INTO coordination_resolution_method_revisions(id,resolution_method_id,company_id,revision,status,name,description,applicability,responsible_trade,constraints,advantages,disadvantages,required_approvals,rfi_requirement,details,authored_by_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14,$15::jsonb,$16)`, [revision.id, revision.resolutionMethodId, revision.companyId, revision.revision, revision.status, revision.name, revision.description, JSON.stringify(revision.applicability), revision.responsibleTrade, JSON.stringify(revision.constraints), JSON.stringify(revision.advantages), JSON.stringify(revision.disadvantages), JSON.stringify(revision.requiredApprovals), revision.rfiRequirement, JSON.stringify(revision.details), revision.authoredById]);
      for (const [index, conflictTypeId] of revision.conflictTypeIds.entries()) await client.query(`INSERT INTO coordination_resolution_method_conflict_types(company_id,resolution_method_revision_id,conflict_type_id,display_order,linked_by_id) VALUES($1,$2,$3,$4,$5)`, [revision.companyId, revision.id, conflictTypeId, index, revision.authoredById]);
      for (const ruleRevisionId of revision.ruleRevisionIds) await client.query(`INSERT INTO coordination_resolution_method_rules(company_id,resolution_method_revision_id,rule_revision_id,linked_by_id) VALUES($1,$2,$3,$4)`, [revision.companyId, revision.id, ruleRevisionId, revision.authoredById]);
      await client.query(`INSERT INTO coordination_knowledge_events(id,company_id,entity_type,entity_id,revision_id,action,actor_id,details) VALUES($1,$2,'resolution_method',$3,$4,'created',$5,$6::jsonb)`, [randomUUID(), revision.companyId, revision.resolutionMethodId, revision.id, revision.authoredById, JSON.stringify({ conflictTypeCount: revision.conflictTypeIds.length, ruleCount: revision.ruleRevisionIds.length })]);
    });
  }

  async assertCanonicalIssueScope(companyIdInput: number, projectIdInput: number, lensViewpointIdInput: number): Promise<void> {
    const companyId = positive(companyIdInput, "companyId"), projectId = positive(projectIdInput, "projectId"), lensViewpointId = positive(lensViewpointIdInput, "lensViewpointId");
    const result = await this.pool.query(`
      SELECT v.id FROM lens_viewpoints v
      JOIN projects p ON p.id=v.project_id
      JOIN users creator ON creator.id=p.created_by_id
      LEFT JOIN LATERAL (
        SELECT company_id FROM project_company_binding_versions b WHERE b.project_id=p.id ORDER BY b.version DESC LIMIT 1
      ) binding ON true
      WHERE v.id=$1 AND v.project_id=$2 AND COALESCE(binding.company_id,creator.company_id)=$3`, [lensViewpointId, projectId, companyId]);
    if (!result.rows[0]) throw new CoordinationKnowledgeRepositoryError("KNOWLEDGE_ISSUE_SCOPE_DENIED", "The canonical BIMLog issue is not available in this organization and project scope.", 403);
  }
}
