import assert from "node:assert/strict";
import { CoordinationKnowledgeRepository, CoordinationKnowledgeRepositoryError, type KnowledgeQueryClient, type KnowledgeRepositoryPool } from "./coordination-knowledge-repository";

type Call = { sql: string; params?: unknown[] };
const calls: Call[] = [];
const fake: KnowledgeRepositoryPool = {
  async query(sql, params) {
    calls.push({ sql, params });
    if (sql.includes("FROM coordination_conflict_types")) return params?.[1] === 7 ? { rows: [{ id: params[0], company_id: 7, status: "approved" }] } : { rows: [] };
    if (sql.includes("FROM lens_viewpoints")) return params?.[2] === 7 ? { rows: [{ id: params[0] }] } : { rows: [] };
    return { rows: [] };
  },
  async connect() {
    const client: KnowledgeQueryClient & { release(): void } = { query: fake.query.bind(fake), release() {} };
    return client;
  },
};
const repository = new CoordinationKnowledgeRepository(fake);
const id = "00000001-1111-4111-8111-000000000001";
assert.equal((await repository.getConflictType(7, id))?.company_id, 7);
assert.equal(await repository.getConflictType(8, id), null, "same stable ID must not cross the organization boundary");
const conflictCalls = calls.filter(call => call.sql.includes("FROM coordination_conflict_types"));
assert.deepEqual(conflictCalls.map(call => call.params?.[1]), [7, 8]);
assert.ok(conflictCalls.every(call => /t\.company_id=\$2/.test(call.sql)), "Conflict Type reads must bind company scope in SQL");
await repository.assertCanonicalIssueScope(7, 28, 184);
await assert.rejects(repository.assertCanonicalIssueScope(8, 28, 184), (error: unknown) => error instanceof CoordinationKnowledgeRepositoryError && error.code === "KNOWLEDGE_ISSUE_SCOPE_DENIED");
const issueCalls = calls.filter(call => call.sql.includes("FROM lens_viewpoints"));
assert.ok(issueCalls.every(call => /v\.project_id=\$2/.test(call.sql) && /COALESCE\(binding\.company_id,creator\.company_id\)=\$3/.test(call.sql)), "canonical issue reads must bind project and company scope");

const denialCalls: Call[] = [];
const denied: KnowledgeRepositoryPool = {
  async query(sql, params) { denialCalls.push({ sql, params }); return { rows: [] }; },
  async connect() { return { release() {}, query: denied.query.bind(denied) }; },
};
const crossTenantRepository = new CoordinationKnowledgeRepository(denied);
const revision = { id: "00000002-1111-4111-8111-000000000002", resolutionMethodId: "00000003-1111-4111-8111-000000000003", companyId: 7, revision: 1, status: "draft" as const, name: "Offset duct", description: "Offset the duct around the obstruction.", applicability: {}, responsibleTrade: "HVAC", constraints: [], advantages: [], disadvantages: [], requiredApprovals: [], rfiRequirement: "conditional" as const, details: {}, conflictTypeIds: [id], ruleRevisionIds: [], authoredById: 12 };
await assert.rejects(crossTenantRepository.createResolutionMethod({ identity: { id: revision.resolutionMethodId, companyId: 7, code: "OFFSET_DUCT", createdById: 12 }, revision }), (error: unknown) => error instanceof CoordinationKnowledgeRepositoryError && error.code === "KNOWLEDGE_CROSS_TENANT_REFERENCE");
assert.ok(denialCalls.some(call => call.sql.includes("ROLLBACK")), "failed cross-tenant relationships must roll back atomically");
console.log("Coordination Knowledge Build 230 repository: tenant-scoped reads, canonical issue scope and cross-tenant relationship denial passed");
