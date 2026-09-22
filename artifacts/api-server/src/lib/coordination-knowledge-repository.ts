import { randomUUID } from "node:crypto";
import {
  assertKnowledgeTransition,
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
export type KnowledgeSearchInput = {
  companyId: number; includeDrafts: boolean; keyword?: string; discipline?: string; conflictTypeId?: string;
  element?: string; category?: string; methodId?: string; projectId?: number; status?: string; tags?: string[];
  page: number; pageSize: number;
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

  async searchKnowledge(input: KnowledgeSearchInput): Promise<{items:Array<Record<string,unknown>>;page:number;pageSize:number;hasMore:boolean}> {
    const companyId=positive(input.companyId,"companyId"), page=positive(input.page,"page"), pageSize=positive(input.pageSize,"pageSize");
    if(pageSize>100) throw new CoordinationKnowledgeRepositoryError("KNOWLEDGE_PAGE_SIZE_INVALID","pageSize cannot exceed 100.");
    const keyword=input.keyword?.trim()||null, discipline=input.discipline?.trim()||null, element=input.element?.trim()||null, category=input.category?.trim()||null;
    const tags=input.tags?.map(tag=>tag.trim()).filter(Boolean)??[];
    const result=await this.pool.query(`WITH candidates AS (
      SELECT 'conflict_type'::text entity_type,base.id entity_id,revision.id revision_id,base.code,revision.status,revision.name title,revision.description,
        revision.discipline_a,revision.discipline_b,revision.element_type_a,revision.element_type_b,revision.conflict_category category,revision.tags,
        base.id conflict_type_id,NULL::text method_id
      FROM coordination_conflict_types base JOIN LATERAL (SELECT * FROM coordination_conflict_type_revisions candidate WHERE candidate.conflict_type_id=base.id AND candidate.company_id=base.company_id AND ($2::boolean OR candidate.status='approved') ORDER BY candidate.revision DESC LIMIT 1) revision ON true WHERE base.company_id=$1
      UNION ALL
      SELECT 'coordination_rule',base.id,revision.id,base.code,revision.status,revision.title,revision.guidance,NULL,NULL,NULL,NULL,NULL,'[]'::jsonb,NULL,NULL
      FROM coordination_rules base JOIN LATERAL (SELECT * FROM coordination_rule_revisions candidate WHERE candidate.rule_id=base.id AND candidate.company_id=base.company_id AND ($2::boolean OR candidate.status='approved') ORDER BY candidate.revision DESC LIMIT 1) revision ON true WHERE base.company_id=$1
      UNION ALL
      SELECT 'resolution_method',base.id,revision.id,base.code,revision.status,revision.name,revision.description,NULL,NULL,NULL,NULL,NULL,'[]'::jsonb,NULL,base.id
      FROM coordination_resolution_methods base JOIN LATERAL (SELECT * FROM coordination_resolution_method_revisions candidate WHERE candidate.resolution_method_id=base.id AND candidate.company_id=base.company_id AND ($2::boolean OR candidate.status='approved') ORDER BY candidate.revision DESC LIMIT 1) revision ON true WHERE base.company_id=$1
    ) SELECT candidate.* FROM candidates candidate WHERE
      ($3::text IS NULL OR candidate.title ILIKE '%'||$3||'%' OR candidate.description ILIKE '%'||$3||'%' OR candidate.code ILIKE '%'||$3||'%')
      AND ($4::text IS NULL OR candidate.discipline_a=$4 OR candidate.discipline_b=$4)
      AND ($5::text IS NULL OR candidate.conflict_type_id=$5 OR EXISTS(SELECT 1 FROM coordination_resolution_method_conflict_types link WHERE link.company_id=$1 AND link.resolution_method_revision_id=candidate.revision_id AND link.conflict_type_id=$5))
      AND ($6::text IS NULL OR candidate.element_type_a=$6 OR candidate.element_type_b=$6)
      AND ($7::text IS NULL OR candidate.category=$7)
      AND ($8::text IS NULL OR candidate.method_id=$8)
      AND ($9::text IS NULL OR candidate.status=$9)
      AND (cardinality($10::text[])=0 OR candidate.tags ?& $10::text[])
      AND ($11::integer IS NULL OR EXISTS(
        SELECT 1 FROM coordination_project_cases project_case
        LEFT JOIN coordination_conflict_type_revisions case_conflict ON case_conflict.id=project_case.conflict_type_revision_id AND case_conflict.company_id=project_case.company_id
        LEFT JOIN coordination_resolution_method_revisions case_method ON case_method.id=project_case.resolution_method_revision_id AND case_method.company_id=project_case.company_id
        WHERE project_case.company_id=$1 AND project_case.project_id=$11 AND (
          case_conflict.conflict_type_id=candidate.entity_id OR case_method.resolution_method_id=candidate.entity_id OR
          (candidate.entity_type='coordination_rule' AND EXISTS(SELECT 1 FROM coordination_resolution_method_rules method_rule WHERE method_rule.company_id=$1 AND method_rule.resolution_method_revision_id=case_method.id AND method_rule.rule_revision_id=candidate.revision_id)))))
      ORDER BY candidate.entity_type,lower(candidate.title),candidate.entity_id,candidate.revision_id
      LIMIT $12 OFFSET $13`,[companyId,input.includeDrafts,keyword,discipline,input.conflictTypeId??null,element,category,input.methodId??null,input.status??null,tags,input.projectId??null,pageSize+1,(page-1)*pageSize]);
    return {items:result.rows.slice(0,pageSize),page,pageSize,hasMore:result.rows.length>pageSize};
  }

  async getConflictType(companyIdInput: number, conflictTypeId: string, includeDrafts = true): Promise<Record<string, unknown> | null> {
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
          AND ($3::boolean OR candidate.status='approved')
        ORDER BY candidate.revision DESC LIMIT 1
      ) r ON true
      WHERE t.id=$1 AND t.company_id=$2`, [conflictTypeId, companyId, includeDrafts]);
    return result.rows[0] ?? null;
  }

  async listConflictTypes(companyIdInput: number, includeDrafts: boolean): Promise<Array<Record<string, unknown>>> {
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
          AND ($2::boolean OR candidate.status='approved')
        ORDER BY candidate.revision DESC LIMIT 1
      ) r ON true
      WHERE t.company_id=$1
      ORDER BY lower(r.name),t.code,t.id`, [companyId, includeDrafts]);
    return result.rows;
  }

  async conflictTypeHistory(companyIdInput: number, conflictTypeId: string, includeDrafts = true): Promise<Array<Record<string, unknown>>> {
    const companyId = positive(companyIdInput, "companyId");
    const result = await this.pool.query(`SELECT revision.* FROM coordination_conflict_type_revisions revision
      WHERE revision.conflict_type_id=$1 AND revision.company_id=$2 AND ($3::boolean OR revision.status='approved')
      ORDER BY revision.revision DESC`, [conflictTypeId, companyId, includeDrafts]);
    return result.rows;
  }

  async appendConflictTypeRevision(input: {
    companyId: number;
    conflictTypeId: string;
    expectedRevision: number;
    actorId: number;
    action: "update_draft" | "submit_for_review" | "return_to_draft" | "approve" | "revise" | "retire";
    rationale?: string;
    content?: Omit<ConflictTypeRevision, "id" | "conflictTypeId" | "companyId" | "revision" | "status" | "authoredById">;
  }): Promise<Record<string, unknown>> {
    return transaction(this.pool, async client => {
      const current = (await client.query(`SELECT * FROM coordination_conflict_type_revisions
        WHERE conflict_type_id=$1 AND company_id=$2 ORDER BY revision DESC LIMIT 1 FOR UPDATE`, [input.conflictTypeId, positive(input.companyId, "companyId")])).rows[0];
      if (!current) throw new CoordinationKnowledgeRepositoryError("KNOWLEDGE_CONFLICT_TYPE_NOT_FOUND", "Conflict Type not found.", 404);
      if (Number(current.revision) !== input.expectedRevision) throw new CoordinationKnowledgeRepositoryError("KNOWLEDGE_VERSION_CONFLICT", "Conflict Type revision is stale.", 409);
      const from = String(current.status) as "draft" | "under_review" | "approved" | "retired";
      let status = from;
      if (input.action === "update_draft") {
        if (from !== "draft") throw new CoordinationKnowledgeRepositoryError("KNOWLEDGE_DRAFT_REQUIRED", "Only a draft may be edited.", 409);
      } else if (input.action === "revise") {
        if (from !== "approved" && from !== "retired") throw new CoordinationKnowledgeRepositoryError("KNOWLEDGE_APPROVED_REVISION_REQUIRED", "Only approved or retired knowledge may start a new draft revision.", 409);
        status = "draft";
      } else {
        status = input.action === "submit_for_review" ? "under_review" : input.action === "return_to_draft" ? "draft" : input.action === "approve" ? "approved" : "retired";
        assertKnowledgeTransition(from, status);
      }
      const next = validateConflictTypeRevision({
        id: randomUUID(), conflictTypeId: input.conflictTypeId, companyId: input.companyId,
        revision: input.expectedRevision + 1, status,
        name: input.content?.name ?? current.name,
        description: input.content?.description ?? current.description,
        disciplineA: input.content?.disciplineA ?? current.discipline_a,
        disciplineB: input.content?.disciplineB ?? current.discipline_b,
        elementTypeA: input.content?.elementTypeA ?? current.element_type_a,
        elementTypeB: input.content?.elementTypeB ?? current.element_type_b,
        conflictCategory: input.content?.conflictCategory ?? current.conflict_category,
        coordinationStage: input.content?.coordinationStage ?? current.coordination_stage,
        tags: input.content?.tags ?? current.tags,
        authoredById: input.actorId,
      });
      const approvalBy = status === "approved" || status === "retired" ? (status === "approved" ? input.actorId : current.approved_by_id) : null;
      const approvalAt = status === "approved" || status === "retired" ? (status === "approved" ? new Date().toISOString() : current.approved_at) : null;
      const retiredBy = status === "retired" ? input.actorId : null;
      const retiredAt = status === "retired" ? new Date().toISOString() : null;
      const inserted = await client.query(`INSERT INTO coordination_conflict_type_revisions
        (id,conflict_type_id,company_id,revision,status,name,description,discipline_a,discipline_b,element_type_a,element_type_b,conflict_category,coordination_stage,tags,authored_by_id,approved_by_id,approved_at,retired_by_id,retired_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$17,$18,$19) RETURNING *`,
        [next.id,next.conflictTypeId,next.companyId,next.revision,next.status,next.name,next.description,next.disciplineA,next.disciplineB,next.elementTypeA,next.elementTypeB,next.conflictCategory,next.coordinationStage,JSON.stringify(next.tags),next.authoredById,approvalBy,approvalAt,retiredBy,retiredAt]);
      await client.query(`UPDATE coordination_conflict_types SET updated_at=now() WHERE id=$1 AND company_id=$2`, [input.conflictTypeId,input.companyId]);
      await client.query(`INSERT INTO coordination_knowledge_events(id,company_id,entity_type,entity_id,revision_id,action,actor_id,details)
        VALUES($1,$2,'conflict_type',$3,$4,$5,$6,$7::jsonb)`, [randomUUID(),input.companyId,input.conflictTypeId,next.id,input.action,input.actorId,JSON.stringify({ from, to: status, expectedRevision: input.expectedRevision, rationale: input.rationale ?? null, decidedAt: new Date().toISOString() })]);
      return inserted.rows[0];
    });
  }

  async listRules(companyIdInput: number, includeDrafts: boolean): Promise<Array<Record<string, unknown>>> {
    const companyId = positive(companyIdInput, "companyId");
    return (await this.pool.query(`SELECT base.*,revision.* FROM coordination_rules base JOIN LATERAL (
      SELECT * FROM coordination_rule_revisions candidate WHERE candidate.rule_id=base.id AND candidate.company_id=base.company_id
        AND ($2::boolean OR candidate.status='approved') ORDER BY candidate.revision DESC LIMIT 1
      ) revision ON true WHERE base.company_id=$1 ORDER BY lower(revision.title),base.code,base.id`, [companyId, includeDrafts])).rows;
  }

  async getRule(companyIdInput: number, ruleId: string, includeDrafts = true): Promise<Record<string, unknown> | null> {
    const companyId = positive(companyIdInput, "companyId");
    return (await this.pool.query(`SELECT base.*,revision.* FROM coordination_rules base JOIN LATERAL (
      SELECT * FROM coordination_rule_revisions candidate WHERE candidate.rule_id=base.id AND candidate.company_id=base.company_id
        AND ($3::boolean OR candidate.status='approved') ORDER BY candidate.revision DESC LIMIT 1
      ) revision ON true WHERE base.id=$1 AND base.company_id=$2`, [ruleId, companyId, includeDrafts])).rows[0] ?? null;
  }

  async ruleHistory(companyIdInput: number, ruleId: string, includeDrafts = true): Promise<Array<Record<string, unknown>>> {
    const companyId = positive(companyIdInput, "companyId");
    return (await this.pool.query(`SELECT * FROM coordination_rule_revisions WHERE rule_id=$1 AND company_id=$2
      AND ($3::boolean OR status='approved') ORDER BY revision DESC`, [ruleId, companyId, includeDrafts])).rows;
  }

  async appendRuleRevision(input: { companyId: number; ruleId: string; expectedRevision: number; actorId: number;
    action: "update_draft" | "submit_for_review" | "return_to_draft" | "approve" | "revise" | "retire";
    rationale?: string;
    content?: Omit<CoordinationRuleRevision, "id" | "ruleId" | "companyId" | "revision" | "status" | "authoredById"> }): Promise<Record<string, unknown>> {
    return transaction(this.pool, async client => {
      const companyId = positive(input.companyId, "companyId");
      const current = (await client.query(`SELECT * FROM coordination_rule_revisions WHERE rule_id=$1 AND company_id=$2 ORDER BY revision DESC LIMIT 1 FOR UPDATE`, [input.ruleId, companyId])).rows[0];
      if (!current) throw new CoordinationKnowledgeRepositoryError("KNOWLEDGE_RULE_NOT_FOUND", "Coordination Rule not found.", 404);
      if (Number(current.revision) !== input.expectedRevision) throw new CoordinationKnowledgeRepositoryError("KNOWLEDGE_VERSION_CONFLICT", "Coordination Rule revision is stale.", 409);
      const from = String(current.status) as "draft" | "under_review" | "approved" | "retired";
      let status = from;
      if (input.action === "update_draft") { if (from !== "draft") throw new CoordinationKnowledgeRepositoryError("KNOWLEDGE_DRAFT_REQUIRED", "Only a draft may be edited.", 409); }
      else if (input.action === "revise") { if (from !== "approved" && from !== "retired") throw new CoordinationKnowledgeRepositoryError("KNOWLEDGE_APPROVED_REVISION_REQUIRED", "Only approved or retired knowledge may start a new draft revision.", 409); status = "draft"; }
      else { status = input.action === "submit_for_review" ? "under_review" : input.action === "return_to_draft" ? "draft" : input.action === "approve" ? "approved" : "retired"; assertKnowledgeTransition(from, status); }
      const next = validateCoordinationRuleRevision({ id: randomUUID(), ruleId: input.ruleId, companyId, revision: input.expectedRevision + 1, status,
        title: input.content?.title ?? current.title, guidance: input.content?.guidance ?? current.guidance,
        applicability: input.content?.applicability ?? current.applicability, rationale: input.content?.rationale ?? current.rationale,
        exceptions: input.content?.exceptions ?? current.exceptions, references: input.content?.references ?? current.references, authoredById: input.actorId });
      const approvedBy = status === "approved" ? input.actorId : status === "retired" ? current.approved_by_id : null;
      const approvedAt = status === "approved" ? new Date().toISOString() : status === "retired" ? current.approved_at : null;
      const inserted = await client.query(`INSERT INTO coordination_rule_revisions
        (id,rule_id,company_id,revision,status,title,guidance,applicability,rationale,exceptions,"references",authored_by_id,approved_by_id,approved_at,retired_by_id,retired_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::jsonb,$11::jsonb,$12,$13,$14,$15,$16) RETURNING *`,
        [next.id,next.ruleId,next.companyId,next.revision,next.status,next.title,next.guidance,JSON.stringify(next.applicability),next.rationale,JSON.stringify(next.exceptions),JSON.stringify(next.references),next.authoredById,approvedBy,approvedAt,status === "retired" ? input.actorId : null,status === "retired" ? new Date().toISOString() : null]);
      await client.query(`UPDATE coordination_rules SET updated_at=now() WHERE id=$1 AND company_id=$2`, [input.ruleId,companyId]);
      await client.query(`INSERT INTO coordination_knowledge_events(id,company_id,entity_type,entity_id,revision_id,action,actor_id,details)
        VALUES($1,$2,'coordination_rule',$3,$4,$5,$6,$7::jsonb)`, [randomUUID(),companyId,input.ruleId,next.id,input.action,input.actorId,JSON.stringify({ from,to:status,expectedRevision:input.expectedRevision,rationale:input.rationale??null,decidedAt:new Date().toISOString() })]);
      return inserted.rows[0];
    });
  }

  async listResolutionMethods(companyIdInput: number, includeDrafts: boolean): Promise<Array<Record<string, unknown>>> {
    const companyId = positive(companyIdInput, "companyId");
    return (await this.pool.query(`SELECT base.*,revision.*,
      COALESCE((SELECT jsonb_agg(link.conflict_type_id ORDER BY link.display_order) FROM coordination_resolution_method_conflict_types link WHERE link.company_id=base.company_id AND link.resolution_method_revision_id=revision.id),'[]'::jsonb) conflict_type_ids,
      COALESCE((SELECT jsonb_agg(link.rule_revision_id) FROM coordination_resolution_method_rules link WHERE link.company_id=base.company_id AND link.resolution_method_revision_id=revision.id),'[]'::jsonb) rule_revision_ids
      FROM coordination_resolution_methods base JOIN LATERAL (
      SELECT * FROM coordination_resolution_method_revisions candidate WHERE candidate.resolution_method_id=base.id AND candidate.company_id=base.company_id
        AND ($2::boolean OR candidate.status='approved') ORDER BY candidate.revision DESC LIMIT 1
      ) revision ON true WHERE base.company_id=$1 ORDER BY lower(revision.name),base.code,base.id`, [companyId, includeDrafts])).rows;
  }

  async getResolutionMethod(companyIdInput: number, methodId: string, includeDrafts = true): Promise<Record<string, unknown> | null> {
    const companyId = positive(companyIdInput, "companyId");
    return (await this.pool.query(`SELECT base.*,revision.*,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('conflictTypeId',link.conflict_type_id,'displayOrder',link.display_order) ORDER BY link.display_order) FROM coordination_resolution_method_conflict_types link WHERE link.company_id=base.company_id AND link.resolution_method_revision_id=revision.id),'[]'::jsonb) conflict_types,
      COALESCE((SELECT jsonb_agg(link.rule_revision_id) FROM coordination_resolution_method_rules link WHERE link.company_id=base.company_id AND link.resolution_method_revision_id=revision.id),'[]'::jsonb) rule_revision_ids
      FROM coordination_resolution_methods base JOIN LATERAL (SELECT * FROM coordination_resolution_method_revisions candidate
      WHERE candidate.resolution_method_id=base.id AND candidate.company_id=base.company_id AND ($3::boolean OR candidate.status='approved') ORDER BY candidate.revision DESC LIMIT 1) revision ON true
      WHERE base.id=$1 AND base.company_id=$2`, [methodId,companyId,includeDrafts])).rows[0] ?? null;
  }

  async resolutionMethodHistory(companyIdInput: number, methodId: string, includeDrafts = true): Promise<Array<Record<string, unknown>>> {
    const companyId = positive(companyIdInput, "companyId");
    return (await this.pool.query(`SELECT revision.* FROM coordination_resolution_method_revisions revision WHERE revision.resolution_method_id=$1 AND revision.company_id=$2
      AND ($3::boolean OR revision.status='approved') ORDER BY revision.revision DESC`, [methodId,companyId,includeDrafts])).rows;
  }

  async listEvidence(companyIdInput:number,entityType:string,entityId:string):Promise<Array<Record<string,unknown>>>{
    const companyId=positive(companyIdInput,"companyId");
    return (await this.pool.query(`SELECT evidence.*,file.file_name,file.file_type,file.file_size
      FROM coordination_knowledge_evidence evidence JOIN files file ON file.id=evidence.file_id
      WHERE evidence.company_id=$1 AND evidence.entity_type=$2 AND evidence.entity_id=$3 ORDER BY evidence.added_at DESC`,[companyId,entityType,entityId])).rows;
  }

  async listEvents(companyIdInput:number,entityType:string,entityId:string):Promise<Array<Record<string,unknown>>>{
    const companyId=positive(companyIdInput,"companyId");
    return (await this.pool.query(`SELECT event.id,event.entity_type,event.entity_id,event.revision_id,event.action,event.actor_id,event.details,event.created_at
      FROM coordination_knowledge_events event WHERE event.company_id=$1 AND event.entity_type=$2 AND event.entity_id=$3 ORDER BY event.created_at DESC`,[companyId,entityType,entityId])).rows;
  }

  async addEvidence(input:{companyId:number;projectId:number;entityType:string;entityId:string;revisionId:string|null;fileId:number;evidenceRole:string;actorId:number}):Promise<Record<string,unknown>>{
    const companyId=positive(input.companyId,"companyId"),projectId=positive(input.projectId,"projectId"),fileId=positive(input.fileId,"fileId");
    return transaction(this.pool,async client=>{
      const file=(await client.query(`SELECT id FROM files WHERE id=$1 AND project_id=$2`,[fileId,projectId])).rows[0];
      if(!file)throw new CoordinationKnowledgeRepositoryError("KNOWLEDGE_EVIDENCE_FILE_SCOPE_INVALID","The file is unavailable in the authorized project.",403);
      const inserted=(await client.query(`INSERT INTO coordination_knowledge_evidence(id,company_id,project_id,entity_type,entity_id,revision_id,file_id,evidence_role,added_by_id)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[randomUUID(),companyId,projectId,input.entityType,input.entityId,input.revisionId,fileId,input.evidenceRole,input.actorId])).rows[0];
      await client.query(`INSERT INTO coordination_knowledge_events(id,company_id,project_id,entity_type,entity_id,revision_id,action,actor_id,details)
        VALUES($1,$2,$3,$4,$5,$6,'evidence_linked',$7,$8::jsonb)`,[randomUUID(),companyId,projectId,input.entityType,input.entityId,input.revisionId,input.actorId,JSON.stringify({fileId,evidenceRole:input.evidenceRole})]);
      return inserted;
    });
  }

  async appendResolutionMethodRevision(input: { companyId: number; resolutionMethodId: string; expectedRevision: number; actorId: number;
    action: "update_draft" | "submit_for_review" | "return_to_draft" | "approve" | "revise" | "retire";
    rationale?: string;
    content?: Omit<ResolutionMethodRevision, "id" | "resolutionMethodId" | "companyId" | "revision" | "status" | "authoredById"> }): Promise<Record<string, unknown>> {
    return transaction(this.pool, async client => {
      const companyId = positive(input.companyId, "companyId");
      const current = (await client.query(`SELECT * FROM coordination_resolution_method_revisions WHERE resolution_method_id=$1 AND company_id=$2 ORDER BY revision DESC LIMIT 1 FOR UPDATE`, [input.resolutionMethodId,companyId])).rows[0];
      if (!current) throw new CoordinationKnowledgeRepositoryError("KNOWLEDGE_RESOLUTION_METHOD_NOT_FOUND", "Resolution Method not found.", 404);
      if (Number(current.revision) !== input.expectedRevision) throw new CoordinationKnowledgeRepositoryError("KNOWLEDGE_VERSION_CONFLICT", "Resolution Method revision is stale.", 409);
      const from = String(current.status) as "draft" | "under_review" | "approved" | "retired";
      let status = from;
      if (input.action === "update_draft") { if (from !== "draft") throw new CoordinationKnowledgeRepositoryError("KNOWLEDGE_DRAFT_REQUIRED", "Only a draft may be edited.", 409); }
      else if (input.action === "revise") { if (from !== "approved" && from !== "retired") throw new CoordinationKnowledgeRepositoryError("KNOWLEDGE_APPROVED_REVISION_REQUIRED", "Only approved or retired knowledge may start a new draft revision.", 409); status = "draft"; }
      else { status = input.action === "submit_for_review" ? "under_review" : input.action === "return_to_draft" ? "draft" : input.action === "approve" ? "approved" : "retired"; assertKnowledgeTransition(from,status); }
      const oldConflicts = (await client.query(`SELECT conflict_type_id FROM coordination_resolution_method_conflict_types WHERE company_id=$1 AND resolution_method_revision_id=$2 ORDER BY display_order`, [companyId,current.id])).rows.map(row => String(row.conflict_type_id));
      const oldRules = (await client.query(`SELECT rule_revision_id FROM coordination_resolution_method_rules WHERE company_id=$1 AND resolution_method_revision_id=$2`, [companyId,current.id])).rows.map(row => String(row.rule_revision_id));
      const next = validateResolutionMethodRevision({ id:randomUUID(),resolutionMethodId:input.resolutionMethodId,companyId,revision:input.expectedRevision+1,status,
        name:input.content?.name ?? current.name,description:input.content?.description ?? current.description,applicability:input.content?.applicability ?? current.applicability,
        responsibleTrade:input.content?.responsibleTrade ?? current.responsible_trade,constraints:input.content?.constraints ?? current.constraints,advantages:input.content?.advantages ?? current.advantages,
        disadvantages:input.content?.disadvantages ?? current.disadvantages,requiredApprovals:input.content?.requiredApprovals ?? current.required_approvals,
        rfiRequirement:input.content?.rfiRequirement ?? current.rfi_requirement,details:input.content?.details ?? current.details,
        conflictTypeIds:input.content?.conflictTypeIds ?? oldConflicts,ruleRevisionIds:input.content?.ruleRevisionIds ?? oldRules,authoredById:input.actorId });
      const conflicts = await client.query(`SELECT id FROM coordination_conflict_types WHERE company_id=$1 AND id=ANY($2::text[])`, [companyId,next.conflictTypeIds]);
      if (conflicts.rows.length !== next.conflictTypeIds.length) throw new CoordinationKnowledgeRepositoryError("KNOWLEDGE_CROSS_TENANT_REFERENCE", "Every Conflict Type must belong to the Resolution Method organization.",403);
      if (next.ruleRevisionIds.length) { const rules = await client.query(`SELECT id FROM coordination_rule_revisions WHERE company_id=$1 AND id=ANY($2::text[])`, [companyId,next.ruleRevisionIds]); if (rules.rows.length !== next.ruleRevisionIds.length) throw new CoordinationKnowledgeRepositoryError("KNOWLEDGE_CROSS_TENANT_REFERENCE", "Every Coordination Rule revision must belong to the Resolution Method organization.",403); }
      const approvedBy=status==="approved"?input.actorId:status==="retired"?current.approved_by_id:null, approvedAt=status==="approved"?new Date().toISOString():status==="retired"?current.approved_at:null;
      const inserted=await client.query(`INSERT INTO coordination_resolution_method_revisions
        (id,resolution_method_id,company_id,revision,status,name,description,applicability,responsible_trade,constraints,advantages,disadvantages,required_approvals,rfi_requirement,details,authored_by_id,approved_by_id,approved_at,retired_by_id,retired_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14,$15::jsonb,$16,$17,$18,$19,$20) RETURNING *`,
        [next.id,next.resolutionMethodId,next.companyId,next.revision,next.status,next.name,next.description,JSON.stringify(next.applicability),next.responsibleTrade,JSON.stringify(next.constraints),JSON.stringify(next.advantages),JSON.stringify(next.disadvantages),JSON.stringify(next.requiredApprovals),next.rfiRequirement,JSON.stringify(next.details),next.authoredById,approvedBy,approvedAt,status==="retired"?input.actorId:null,status==="retired"?new Date().toISOString():null]);
      for(const [index,conflictTypeId] of next.conflictTypeIds.entries()) await client.query(`INSERT INTO coordination_resolution_method_conflict_types(company_id,resolution_method_revision_id,conflict_type_id,display_order,linked_by_id) VALUES($1,$2,$3,$4,$5)`,[companyId,next.id,conflictTypeId,index,input.actorId]);
      for(const ruleRevisionId of next.ruleRevisionIds) await client.query(`INSERT INTO coordination_resolution_method_rules(company_id,resolution_method_revision_id,rule_revision_id,linked_by_id) VALUES($1,$2,$3,$4)`,[companyId,next.id,ruleRevisionId,input.actorId]);
      await client.query(`UPDATE coordination_resolution_methods SET updated_at=now() WHERE id=$1 AND company_id=$2`,[input.resolutionMethodId,companyId]);
      await client.query(`INSERT INTO coordination_knowledge_events(id,company_id,entity_type,entity_id,revision_id,action,actor_id,details) VALUES($1,$2,'resolution_method',$3,$4,$5,$6,$7::jsonb)`,[randomUUID(),companyId,input.resolutionMethodId,next.id,input.action,input.actorId,JSON.stringify({from,to:status,expectedRevision:input.expectedRevision,rationale:input.rationale??null,decidedAt:new Date().toISOString()})]);
      return inserted.rows[0];
    });
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

  async classifyLensIssue(input: { companyId: number; projectId: number; lensViewpointId: number; conflictTypeRevisionId: string | null; expectedConflictTypeRevisionId: string | null; actorId: number }): Promise<void> {
    const companyId=positive(input.companyId,"companyId"),projectId=positive(input.projectId,"projectId"),lensViewpointId=positive(input.lensViewpointId,"lensViewpointId"),actorId=positive(input.actorId,"actorId");
    await this.assertCanonicalIssueScope(companyId,projectId,lensViewpointId);
    await transaction(this.pool,async client=>{
      const existing=(await client.query(`SELECT id,conflict_type_revision_id FROM coordination_project_cases WHERE company_id=$1 AND project_id=$2 AND lens_viewpoint_id=$3 FOR UPDATE`,[companyId,projectId,lensViewpointId])).rows[0]??null;
      const observed=existing?.conflict_type_revision_id==null?null:String(existing.conflict_type_revision_id);
      if(observed!==input.expectedConflictTypeRevisionId) throw new CoordinationKnowledgeRepositoryError("KNOWLEDGE_CLASSIFICATION_STALE","The issue classification changed after it was loaded.",409);
      if(input.conflictTypeRevisionId){
        const approved=(await client.query(`SELECT id FROM coordination_conflict_type_revisions WHERE id=$1 AND company_id=$2 AND status='approved'`,[input.conflictTypeRevisionId,companyId])).rows[0];
        if(!approved) throw new CoordinationKnowledgeRepositoryError("KNOWLEDGE_APPROVED_CLASSIFICATION_REQUIRED","Only an approved Conflict Type revision may classify an issue.",409);
      }
      if(observed===input.conflictTypeRevisionId) return;
      const projectCaseId=existing?String(existing.id):randomUUID();
      if(existing) await client.query(`UPDATE coordination_project_cases SET conflict_type_revision_id=$1,updated_at=now() WHERE id=$2 AND company_id=$3 AND project_id=$4`,[input.conflictTypeRevisionId,projectCaseId,companyId,projectId]);
      else if(input.conflictTypeRevisionId) await client.query(`INSERT INTO coordination_project_cases(id,company_id,project_id,lens_viewpoint_id,conflict_type_revision_id,created_by_id) VALUES($1,$2,$3,$4,$5,$6)`,[projectCaseId,companyId,projectId,lensViewpointId,input.conflictTypeRevisionId,actorId]);
      else return;
      await client.query(`INSERT INTO coordination_knowledge_events(id,company_id,entity_type,entity_id,revision_id,action,actor_id,details) VALUES($1,$2,'project_case',$3,$4,'issue_classification_changed',$5,$6::jsonb)`,[randomUUID(),companyId,projectCaseId,input.conflictTypeRevisionId,actorId,JSON.stringify({fromConflictTypeRevisionId:observed,toConflictTypeRevisionId:input.conflictTypeRevisionId,projectId,lensViewpointId})]);
    });
  }

  async getLensContext(input: { companyId: number; projectId: number; lensViewpointId: number; allowCompanyPrecedent: boolean }): Promise<Record<string, unknown>> {
    const companyId=positive(input.companyId,"companyId"),projectId=positive(input.projectId,"projectId"),lensViewpointId=positive(input.lensViewpointId,"lensViewpointId");
    await this.assertCanonicalIssueScope(companyId,projectId,lensViewpointId);
    const current=(await this.pool.query(`SELECT project_case.id,project_case.conflict_type_revision_id,
      conflict.id conflict_revision_id,conflict.conflict_type_id,conflict.revision,conflict.name,conflict.description,
      conflict.discipline_a,conflict.discipline_b,conflict.element_type_a,conflict.element_type_b,conflict.conflict_category,
      base.code
      FROM coordination_project_cases project_case
      LEFT JOIN coordination_conflict_type_revisions conflict ON conflict.id=project_case.conflict_type_revision_id AND conflict.company_id=project_case.company_id
      LEFT JOIN coordination_conflict_types base ON base.id=conflict.conflict_type_id AND base.company_id=conflict.company_id
      WHERE project_case.company_id=$1 AND project_case.project_id=$2 AND project_case.lens_viewpoint_id=$3`,[companyId,projectId,lensViewpointId])).rows[0]??null;
    const availableConflictTypes=(await this.pool.query(`SELECT base.id,revision.id revision_id,revision.revision,base.code,revision.name,revision.description,revision.discipline_a,revision.discipline_b,revision.element_type_a,revision.element_type_b,revision.conflict_category
      FROM coordination_conflict_types base JOIN LATERAL (SELECT * FROM coordination_conflict_type_revisions candidate WHERE candidate.conflict_type_id=base.id AND candidate.company_id=base.company_id AND candidate.status='approved' ORDER BY candidate.revision DESC LIMIT 1) revision ON true
      WHERE base.company_id=$1 ORDER BY lower(revision.name),base.code`,[companyId])).rows.map(row=>({id:String(row.id),revisionId:String(row.revision_id),revision:Number(row.revision),code:String(row.code),name:String(row.name),description:String(row.description),disciplineA:String(row.discipline_a),disciplineB:String(row.discipline_b),elementTypeA:String(row.element_type_a),elementTypeB:String(row.element_type_b),category:String(row.conflict_category)}));
    if(!current?.conflict_type_id) return {conflictType:null,availableConflictTypes,rules:[],methods:[],previousCases:[]};
    const conflictType={id:String(current.conflict_type_id),revisionId:String(current.conflict_revision_id),revision:Number(current.revision),code:String(current.code),name:String(current.name),description:String(current.description),disciplineA:String(current.discipline_a),disciplineB:String(current.discipline_b),elementTypeA:String(current.element_type_a),elementTypeB:String(current.element_type_b),category:String(current.conflict_category)};
    const methods=(await this.pool.query(`SELECT method.id,revision.id revision_id,revision.revision,method.code,revision.name,revision.description,
      revision.responsible_trade,revision.constraints,revision.required_approvals,revision.rfi_requirement,revision.details,link.display_order
      FROM coordination_resolution_method_conflict_types link
      JOIN coordination_resolution_method_revisions revision ON revision.id=link.resolution_method_revision_id AND revision.company_id=link.company_id AND revision.status='approved'
      JOIN coordination_resolution_methods method ON method.id=revision.resolution_method_id AND method.company_id=revision.company_id
      WHERE link.company_id=$1 AND link.conflict_type_id=$2
      ORDER BY link.display_order,lower(revision.name),method.code,revision.revision DESC`,[companyId,current.conflict_type_id])).rows.map(row=>({id:String(row.id),revisionId:String(row.revision_id),revision:Number(row.revision),code:String(row.code),name:String(row.name),description:String(row.description),responsibleTrade:row.responsible_trade==null?null:String(row.responsible_trade),constraints:Array.isArray(row.constraints)?row.constraints.map(String):[],requiredApprovals:Array.isArray(row.required_approvals)?row.required_approvals.map(String):[],rfiRequirement:String(row.rfi_requirement),preferred:typeof row.details==="object"&&row.details!==null&&(row.details as Record<string,unknown>).preferred===true}));
    const rules=(await this.pool.query(`SELECT DISTINCT rule.id,rule_revision.id revision_id,rule_revision.revision,rule.code,rule_revision.title,rule_revision.guidance
      FROM coordination_resolution_method_conflict_types conflict_link
      JOIN coordination_resolution_method_revisions method_revision ON method_revision.id=conflict_link.resolution_method_revision_id AND method_revision.company_id=conflict_link.company_id AND method_revision.status='approved'
      JOIN coordination_resolution_method_rules method_rule ON method_rule.resolution_method_revision_id=method_revision.id AND method_rule.company_id=method_revision.company_id
      JOIN coordination_rule_revisions rule_revision ON rule_revision.id=method_rule.rule_revision_id AND rule_revision.company_id=method_rule.company_id AND rule_revision.status='approved'
      JOIN coordination_rules rule ON rule.id=rule_revision.rule_id AND rule.company_id=rule_revision.company_id
      WHERE conflict_link.company_id=$1 AND conflict_link.conflict_type_id=$2
      ORDER BY rule.code,rule_revision.revision DESC`,[companyId,current.conflict_type_id])).rows.map(row=>({id:String(row.id),revisionId:String(row.revision_id),revision:Number(row.revision),code:String(row.code),title:String(row.title),guidance:String(row.guidance)}));
    const previousCases=(await this.pool.query(`SELECT precedent.id,precedent.project_id,project.name project_name,viewpoint.floor location,
      precedent.actual_resolution,precedent.status,CASE WHEN EXISTS(SELECT 1 FROM linked_items link WHERE link.project_id=precedent.project_id AND ((link.from_type='lens_viewpoint' AND link.from_id=precedent.lens_viewpoint_id AND link.to_type='rfi') OR (link.to_type='lens_viewpoint' AND link.to_id=precedent.lens_viewpoint_id AND link.from_type='rfi'))) THEN 'Linked' ELSE 'Not linked' END rfi_state
      FROM coordination_project_cases precedent
      JOIN coordination_conflict_type_revisions precedent_conflict ON precedent_conflict.id=precedent.conflict_type_revision_id AND precedent_conflict.company_id=precedent.company_id
      JOIN projects project ON project.id=precedent.project_id
      JOIN lens_viewpoints viewpoint ON viewpoint.id=precedent.lens_viewpoint_id AND viewpoint.project_id=precedent.project_id
      WHERE precedent.company_id=$1 AND precedent.lens_viewpoint_id<>$2 AND precedent_conflict.conflict_type_id=$3
        AND precedent.status IN ('resolved','verified') AND ($4::boolean OR precedent.project_id=$5)
      ORDER BY precedent.verified_at DESC NULLS LAST,precedent.resolved_at DESC NULLS LAST,precedent.id LIMIT 8`,[companyId,lensViewpointId,current.conflict_type_id,input.allowCompanyPrecedent,projectId])).rows.map(row=>({id:String(row.id),projectId:Number(row.project_id),projectName:String(row.project_name),location:row.location==null?null:String(row.location),actualResolution:String(row.actual_resolution),rfiState:String(row.rfi_state),status:String(row.status)}));
    return {conflictType,availableConflictTypes,rules,methods,previousCases};
  }
}
