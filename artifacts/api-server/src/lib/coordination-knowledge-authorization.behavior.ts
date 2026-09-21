import assert from "node:assert/strict";
import {
  CoordinationKnowledgeAuthorizationError,
  requireKnowledgeCapability,
  resolveKnowledgeAuthorizationContext,
} from "./coordination-knowledge-authorization";
import type { KnowledgeQueryClient } from "./coordination-knowledge-repository";

const row = (values: Record<string, unknown>): KnowledgeQueryClient => ({ async query() { return { rows: [values] }; } });
const pmo = await resolveKnowledgeAuthorizationContext(row({ id: 7, company_id: 42, is_super_admin: false, is_company_pmo: true, project_role: null }), 7);
assert.equal(pmo.companyId, 42);
assert.equal(pmo.isCompanyPmo, true);
assert.equal(pmo.isSuperAdmin, false, "Company PMO must never imply Super Administrator");
for (const capability of ["view_approved", "view_draft", "create_draft", "approve", "retire", "manage_taxonomy"] as const) {
  requireKnowledgeCapability(pmo, capability);
}

const member = await resolveKnowledgeAuthorizationContext(row({ id: 8, company_id: 42, is_super_admin: false, is_company_pmo: false, project_role: "member" }), 8, 28);
requireKnowledgeCapability(member, "view_approved");
requireKnowledgeCapability(member, "propose_lesson");
assert.throws(() => requireKnowledgeCapability(member, "view_draft"), (error: unknown) => error instanceof CoordinationKnowledgeAuthorizationError && error.status === 403);

await assert.rejects(
  resolveKnowledgeAuthorizationContext(row({ id: 9, company_id: 42, is_super_admin: false, is_company_pmo: false, project_role: null }), 9, 99),
  (error: unknown) => error instanceof CoordinationKnowledgeAuthorizationError && error.code === "KNOWLEDGE_PROJECT_ACCESS_DENIED",
);
const calls: unknown[][] = [];
const crossCompanyProbe: KnowledgeQueryClient = { async query(_sql, params) { calls.push(params ?? []); return { rows: [] }; } };
await assert.rejects(resolveKnowledgeAuthorizationContext(crossCompanyProbe, 10, 101), CoordinationKnowledgeAuthorizationError);
assert.deepEqual(calls[0], [10, 101], "the actor and project are server-resolved; no client company identifier is accepted");

console.log("Coordination Knowledge Build 231 authorization: company scope, project scope, PMO separation and negative capabilities passed");
