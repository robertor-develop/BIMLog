import { randomUUID } from "node:crypto";
import type { KnowledgeRepositoryPool } from "./coordination-knowledge-repository";
import { CoordinationKnowledgeRepositoryError } from "./coordination-knowledge-repository";
import { starterTaxonomyKinds, type StarterTaxonomyKind } from "./coordination-knowledge-starter-seed";

export type TaxonomyTermInput = Readonly<{ kind: StarterTaxonomyKind; code: string; label: string }>;
const codePattern = /^[A-Z0-9][A-Z0-9._-]{0,63}$/;

function text(value: unknown, field: string, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new CoordinationKnowledgeRepositoryError("KNOWLEDGE_TAXONOMY_INVALID", field);
  return value.trim();
}

export function normalizeTaxonomyTerm(value: Record<string, unknown>): TaxonomyTermInput & { normalizedKey: string } {
  const kind = value.kind;
  if (typeof kind !== "string" || !starterTaxonomyKinds.includes(kind as StarterTaxonomyKind)) throw new CoordinationKnowledgeRepositoryError("KNOWLEDGE_TAXONOMY_INVALID", "kind");
  const code = text(value.code, "code", 64).toUpperCase();
  if (!codePattern.test(code)) throw new CoordinationKnowledgeRepositoryError("KNOWLEDGE_TAXONOMY_INVALID", "code");
  const label = text(value.label, "label", 160).replace(/\s+/g, " ");
  return { kind: kind as StarterTaxonomyKind, code, label, normalizedKey: label.normalize("NFKC").toLocaleLowerCase("en-US") };
}

async function tx<T>(pool: KnowledgeRepositoryPool, work: (client: { query(sql: string, params?: unknown[]): Promise<{ rows: Array<Record<string, unknown>>; rowCount?: number | null }> }) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { await client.query("BEGIN"); const value = await work(client); await client.query("COMMIT"); return value; }
  catch (error) { await client.query("ROLLBACK"); if ((error as { code?: string })?.code === "23505") throw new CoordinationKnowledgeRepositoryError("KNOWLEDGE_TAXONOMY_DUPLICATE", "A matching taxonomy value already exists.", 409); throw error; }
  finally { client.release(); }
}

export class CoordinationKnowledgeTaxonomyRepository {
  constructor(private readonly pool: KnowledgeRepositoryPool) {}

  async list(companyId: number, kind?: StarterTaxonomyKind, includeRetired = false) {
    return (await this.pool.query(`SELECT base.id,base.company_id,base.kind,base.normalized_key,revision.revision,revision.status,revision.code,revision.label,revision.updated_by_id,revision.created_at
      FROM coordination_knowledge_taxonomy_terms base JOIN LATERAL (
        SELECT * FROM coordination_knowledge_taxonomy_term_revisions candidate WHERE candidate.term_id=base.id AND candidate.company_id=base.company_id ORDER BY candidate.revision DESC LIMIT 1
      ) revision ON true WHERE base.company_id=$1 AND ($2::text IS NULL OR base.kind=$2) AND ($3::boolean OR revision.status='active')
      ORDER BY base.kind,lower(revision.label),revision.code`, [companyId, kind ?? null, includeRetired])).rows;
  }

  async create(companyId: number, actorId: number, raw: Record<string, unknown>) {
    const input = normalizeTaxonomyTerm(raw), termId = randomUUID(), revisionId = randomUUID();
    return tx(this.pool, async client => {
      await client.query(`INSERT INTO coordination_knowledge_taxonomy_terms(id,company_id,kind,normalized_key,created_by_id) VALUES($1,$2,$3,$4,$5)`, [termId, companyId, input.kind, input.normalizedKey, actorId]);
      const result = await client.query(`INSERT INTO coordination_knowledge_taxonomy_term_revisions(id,term_id,company_id,revision,status,code,label,updated_by_id) VALUES($1,$2,$3,1,'active',$4,$5,$6) RETURNING *`, [revisionId, termId, companyId, input.code, input.label, actorId]);
      await client.query(`INSERT INTO coordination_knowledge_events(id,company_id,entity_type,entity_id,revision_id,action,actor_id,details) VALUES($1,$2,'taxonomy_term',$3,$4,'created',$5,$6::jsonb)`, [randomUUID(), companyId, termId, revisionId, actorId, JSON.stringify({ kind: input.kind, normalizedKey: input.normalizedKey })]);
      return result.rows[0];
    });
  }

  async revise(companyId: number, actorId: number, termId: string, expectedRevision: number, raw: Record<string, unknown>, retire = false) {
    return tx(this.pool, async client => {
      const current = (await client.query(`SELECT base.kind,base.normalized_key,revision.* FROM coordination_knowledge_taxonomy_terms base JOIN LATERAL (SELECT * FROM coordination_knowledge_taxonomy_term_revisions candidate WHERE candidate.term_id=base.id AND candidate.company_id=base.company_id ORDER BY candidate.revision DESC LIMIT 1 FOR UPDATE) revision ON true WHERE base.id=$1 AND base.company_id=$2`, [termId, companyId])).rows[0];
      if (!current) throw new CoordinationKnowledgeRepositoryError("KNOWLEDGE_TAXONOMY_NOT_FOUND", "Taxonomy term not found.", 404);
      if (Number(current.revision) !== expectedRevision) throw new CoordinationKnowledgeRepositoryError("KNOWLEDGE_VERSION_CONFLICT", "Taxonomy term revision is stale.", 409);
      if (current.status === "retired") throw new CoordinationKnowledgeRepositoryError("KNOWLEDGE_TAXONOMY_RETIRED", "Retired taxonomy values remain historical and cannot be changed.", 409);
      const input = retire ? normalizeTaxonomyTerm({ kind: current.kind, code: current.code, label: current.label }) : normalizeTaxonomyTerm({ ...raw, kind: current.kind });
      if (!retire && input.normalizedKey !== current.normalized_key) await client.query(`UPDATE coordination_knowledge_taxonomy_terms SET normalized_key=$1 WHERE id=$2 AND company_id=$3`, [input.normalizedKey, termId, companyId]);
      const revisionId = randomUUID(), status = retire ? "retired" : "active";
      const result = await client.query(`INSERT INTO coordination_knowledge_taxonomy_term_revisions(id,term_id,company_id,revision,status,code,label,updated_by_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [revisionId, termId, companyId, expectedRevision + 1, status, input.code, input.label, actorId]);
      await client.query(`INSERT INTO coordination_knowledge_events(id,company_id,entity_type,entity_id,revision_id,action,actor_id,details) VALUES($1,$2,'taxonomy_term',$3,$4,$5,$6,$7::jsonb)`, [randomUUID(), companyId, termId, revisionId, retire ? "retired" : "revised", actorId, JSON.stringify({ fromRevision: expectedRevision, kind: input.kind })]);
      return result.rows[0];
    });
  }
}
