import { randomUUID } from "node:crypto";
import type { KnowledgeQueryClient, KnowledgeRepositoryPool } from "./coordination-knowledge-repository";
import { CoordinationKnowledgeRepositoryError } from "./coordination-knowledge-repository";
import { deterministicStarterId, starterSeedFingerprint, type CoordinationStarterSeed } from "./coordination-knowledge-starter-seed";

export type StarterImportResult = Readonly<{
  companyId: number;
  seedKey: string;
  fingerprint: string;
  status: "imported" | "idempotent_noop";
  created: Readonly<{ conflictTypes: number; rules: number; resolutionMethods: number }>;
  existing: Readonly<{ conflictTypes: number; rules: number; resolutionMethods: number }>;
}>;

function positive(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new CoordinationKnowledgeRepositoryError("STARTER_IMPORT_SCOPE_INVALID", field);
  return value;
}

async function selectByCode(client: KnowledgeQueryClient, table: "coordination_conflict_types" | "coordination_rules" | "coordination_resolution_methods", companyId: number, code: string) {
  return (await client.query(`SELECT id FROM ${table} WHERE company_id=$1 AND code=$2`, [companyId, code])).rows[0] ?? null;
}

export class CoordinationStarterLibraryImporter {
  constructor(private readonly pool: KnowledgeRepositoryPool) {}

  async import(companyIdInput: number, actorIdInput: number, seed: CoordinationStarterSeed): Promise<StarterImportResult> {
    const companyId = positive(companyIdInput, "companyId"), actorId = positive(actorIdInput, "actorId");
    const fingerprint = starterSeedFingerprint(seed), scopeKey = `${seed.seedKey}.${companyId}`;
    const client = await this.pool.connect();
    const created = { conflictTypes: 0, rules: 0, resolutionMethods: 0 }, existing = { conflictTypes: 0, rules: 0, resolutionMethods: 0 };
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`bimlog:starter-seed:${companyId}:${seed.seedKey}`]);
      const conflictIds = new Map<string, string>();
      for (const item of seed.conflictTypes) {
        const found = await selectByCode(client, "coordination_conflict_types", companyId, item.code);
        if (found) { conflictIds.set(item.code, String(found.id)); existing.conflictTypes += 1; continue; }
        const id = deterministicStarterId(scopeKey, "conflict_type", item.code), revisionId = deterministicStarterId(scopeKey, "conflict_type_revision", item.code);
        await client.query(`INSERT INTO coordination_conflict_types(id,company_id,code,created_by_id) VALUES($1,$2,$3,$4)`, [id, companyId, item.code, actorId]);
        await client.query(`INSERT INTO coordination_conflict_type_revisions(id,conflict_type_id,company_id,revision,status,name,description,discipline_a,discipline_b,element_type_a,element_type_b,conflict_category,coordination_stage,tags,authored_by_id) VALUES($1,$2,$3,1,'draft',$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13)`, [revisionId, id, companyId, item.name, item.description, item.disciplineA, item.disciplineB, item.elementTypeA, item.elementTypeB, item.conflictCategory, item.coordinationStage, JSON.stringify(item.tags), actorId]);
        await client.query(`INSERT INTO coordination_knowledge_events(id,company_id,entity_type,entity_id,revision_id,action,actor_id,details) VALUES($1,$2,'conflict_type',$3,$4,'starter_seed_created',$5,$6::jsonb)`, [randomUUID(), companyId, id, revisionId, actorId, JSON.stringify({ seedKey: seed.seedKey, fingerprint, synthetic: true, professionalApproval: "not_reviewed" })]);
        conflictIds.set(item.code, id); created.conflictTypes += 1;
      }

      const ruleIds = new Map<string, { id: string; revisionId: string }>();
      for (const item of seed.rules) {
        const found = await selectByCode(client, "coordination_rules", companyId, item.code);
        if (found) {
          const revision = (await client.query(`SELECT id FROM coordination_rule_revisions WHERE company_id=$1 AND rule_id=$2 ORDER BY revision DESC LIMIT 1`, [companyId, found.id])).rows[0];
          ruleIds.set(item.code, { id: String(found.id), revisionId: String(revision?.id ?? "") }); existing.rules += 1; continue;
        }
        const id = deterministicStarterId(scopeKey, "rule", item.code), revisionId = deterministicStarterId(scopeKey, "rule_revision", item.code);
        const linkedConflictIds = item.conflictTypeCodes.map(code => conflictIds.get(code));
        if (linkedConflictIds.some(id => !id)) throw new CoordinationKnowledgeRepositoryError("STARTER_IMPORT_REFERENCE_INVALID", `Unknown Conflict Type for ${item.code}.`, 409);
        await client.query(`INSERT INTO coordination_rules(id,company_id,code,created_by_id) VALUES($1,$2,$3,$4)`, [id, companyId, item.code, actorId]);
        await client.query(`INSERT INTO coordination_rule_revisions(id,rule_id,company_id,revision,status,title,guidance,applicability,rationale,exceptions,"references",authored_by_id) VALUES($1,$2,$3,1,'draft',$4,$5,$6::jsonb,$7,$8::jsonb,'[]'::jsonb,$9)`, [revisionId, id, companyId, item.title, item.guidance, JSON.stringify({ conflictTypeIds: linkedConflictIds }), item.rationale, JSON.stringify(item.exceptions), actorId]);
        await client.query(`INSERT INTO coordination_knowledge_events(id,company_id,entity_type,entity_id,revision_id,action,actor_id,details) VALUES($1,$2,'coordination_rule',$3,$4,'starter_seed_created',$5,$6::jsonb)`, [randomUUID(), companyId, id, revisionId, actorId, JSON.stringify({ seedKey: seed.seedKey, fingerprint, synthetic: true, professionalApproval: "not_reviewed" })]);
        ruleIds.set(item.code, { id, revisionId }); created.rules += 1;
      }

      for (const item of seed.resolutionMethods) {
        const found = await selectByCode(client, "coordination_resolution_methods", companyId, item.code);
        if (found) { existing.resolutionMethods += 1; continue; }
        const id = deterministicStarterId(scopeKey, "resolution_method", item.code), revisionId = deterministicStarterId(scopeKey, "resolution_method_revision", item.code);
        const linkedConflictIds = item.conflictTypeCodes.map(code => conflictIds.get(code));
        const linkedRuleRevisionIds = item.ruleCodes.map(code => ruleIds.get(code)?.revisionId);
        if (linkedConflictIds.some(value => !value) || linkedRuleRevisionIds.some(value => !value)) throw new CoordinationKnowledgeRepositoryError("STARTER_IMPORT_REFERENCE_INVALID", `Unknown starter relationship for ${item.code}.`, 409);
        await client.query(`INSERT INTO coordination_resolution_methods(id,company_id,code,created_by_id) VALUES($1,$2,$3,$4)`, [id, companyId, item.code, actorId]);
        await client.query(`INSERT INTO coordination_resolution_method_revisions(id,resolution_method_id,company_id,revision,status,name,description,applicability,responsible_trade,constraints,advantages,disadvantages,required_approvals,rfi_requirement,details,authored_by_id) VALUES($1,$2,$3,1,'draft',$4,$5,$6::jsonb,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12,$13::jsonb,$14)`, [revisionId, id, companyId, item.name, item.description, JSON.stringify({ source: "synthetic_starter", professionalApproval: "not_reviewed" }), item.responsibleTrade, JSON.stringify(item.constraints), JSON.stringify(item.advantages), JSON.stringify(item.disadvantages), JSON.stringify(item.requiredApprovals), item.rfiRequirement, JSON.stringify({ seedKey: seed.seedKey, fingerprint, preferred: false, precedent: false }), actorId]);
        for (const [index, conflictTypeId] of linkedConflictIds.entries()) await client.query(`INSERT INTO coordination_resolution_method_conflict_types(company_id,resolution_method_revision_id,conflict_type_id,display_order,linked_by_id) VALUES($1,$2,$3,$4,$5)`, [companyId, revisionId, conflictTypeId, index, actorId]);
        for (const ruleRevisionId of linkedRuleRevisionIds) await client.query(`INSERT INTO coordination_resolution_method_rules(company_id,resolution_method_revision_id,rule_revision_id,linked_by_id) VALUES($1,$2,$3,$4)`, [companyId, revisionId, ruleRevisionId, actorId]);
        await client.query(`INSERT INTO coordination_knowledge_events(id,company_id,entity_type,entity_id,revision_id,action,actor_id,details) VALUES($1,$2,'resolution_method',$3,$4,'starter_seed_created',$5,$6::jsonb)`, [randomUUID(), companyId, id, revisionId, actorId, JSON.stringify({ seedKey: seed.seedKey, fingerprint, synthetic: true, professionalApproval: "not_reviewed" })]);
        created.resolutionMethods += 1;
      }

      const totalCreated = created.conflictTypes + created.rules + created.resolutionMethods;
      await client.query(`INSERT INTO coordination_knowledge_events(id,company_id,entity_type,entity_id,action,actor_id,details) VALUES($1,$2,'starter_library',$3,$4,$5,$6::jsonb)`, [randomUUID(), companyId, seed.seedKey, totalCreated ? "starter_seed_imported" : "starter_seed_reimport_noop", actorId, JSON.stringify({ fingerprint, provenance: seed.provenance, created, existing })]);
      await client.query("COMMIT");
      return Object.freeze({ companyId, seedKey: seed.seedKey, fingerprint, status: totalCreated ? "imported" : "idempotent_noop", created: Object.freeze(created), existing: Object.freeze(existing) });
    } catch (error) {
      await client.query("ROLLBACK");
      if ((error as { code?: string })?.code === "23505") throw new CoordinationKnowledgeRepositoryError("STARTER_IMPORT_CONFLICT", "A starter identity conflicts with an existing organization record.", 409);
      throw error;
    } finally { client.release(); }
  }
}
