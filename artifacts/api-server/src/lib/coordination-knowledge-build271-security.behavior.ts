import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CoordinationKnowledgeAuthorizationError,
  requireKnowledgeCapability,
  resolveKnowledgeAuthorizationContext,
} from "./coordination-knowledge-authorization";
import type { KnowledgeQueryClient } from "./coordination-knowledge-repository";

const row = (value: Record<string, unknown>): KnowledgeQueryClient => ({
  async query() { return { rows: [value] }; },
});
const denied = (fn: () => unknown, code = "KNOWLEDGE_CAPABILITY_REQUIRED") => assert.throws(
  fn,
  (error: unknown) => error instanceof CoordinationKnowledgeAuthorizationError && error.status === 403 && error.code === code,
);

const rubenPmo = await resolveKnowledgeAuthorizationContext(row({
  id: 71,
  company_id: 42,
  is_super_admin: false,
  is_company_pmo: true,
  project_role: null,
}), 71);
assert.equal(rubenPmo.companyId, 42);
assert.equal(rubenPmo.isCompanyPmo, true);
assert.equal(rubenPmo.isSuperAdmin, false, "Company PMO must never escalate to Super Administrator");
for (const capability of ["view_draft", "approve", "retire", "manage_taxonomy"] as const) {
  requireKnowledgeCapability(rubenPmo, capability);
}

const projectMember = await resolveKnowledgeAuthorizationContext(row({
  id: 72,
  company_id: 42,
  is_super_admin: false,
  is_company_pmo: false,
  project_role: "member",
}), 72, 501);
for (const capability of ["view_approved", "classify_issue", "select_resolution", "document_outcome", "propose_lesson"] as const) {
  requireKnowledgeCapability(projectMember, capability);
}
for (const capability of ["view_draft", "approve", "retire", "manage_taxonomy", "promote_approved_lesson"] as const) {
  denied(() => requireKnowledgeCapability(projectMember, capability));
}

const readOnly = await resolveKnowledgeAuthorizationContext(row({
  id: 73,
  company_id: 42,
  is_super_admin: false,
  is_company_pmo: false,
  project_role: "read_only",
}), 73, 501);
requireKnowledgeCapability(readOnly, "view_approved");
for (const capability of ["classify_issue", "select_resolution", "document_outcome", "propose_lesson"] as const) {
  denied(() => requireKnowledgeCapability(readOnly, capability));
}

await assert.rejects(
  resolveKnowledgeAuthorizationContext(row({
    id: 74,
    company_id: 42,
    is_super_admin: false,
    is_company_pmo: false,
    project_role: null,
  }), 74, 999),
  (error: unknown) => error instanceof CoordinationKnowledgeAuthorizationError
    && error.status === 403
    && error.code === "KNOWLEDGE_PROJECT_ACCESS_DENIED",
  "cross-project access must fail closed",
);

const route = readFileSync(new URL("../routes/coordination-knowledge.ts", import.meta.url), "utf8");
const repository = readFileSync(new URL("./coordination-knowledge-repository.ts", import.meta.url), "utf8");
const taxonomy = readFileSync(new URL("./coordination-knowledge-taxonomy.ts", import.meta.url), "utf8");
const authorization = readFileSync(new URL("./coordination-knowledge-authorization.ts", import.meta.url), "utf8");
const routeDeclarations = route.split(/\r?\n/).filter(line => /router\.(?:get|post|put|patch|delete)\(/.test(line));
assert.ok(routeDeclarations.length >= 25, "the complete direct endpoint surface must be audited");
for (const declaration of routeDeclarations) {
  assert.match(declaration, /authMiddleware/, `direct endpoint is missing authentication: ${declaration.trim()}`);
}
assert.doesNotMatch(route, /req\.(?:body|query|params)\??\.companyId/, "company authority must never come from the request");
assert.match(authorization, /company_master_catalog_administrators/);
assert.match(authorization, /project_company_binding_versions/);
assert.match(authorization, /COALESCE\(project_binding\.company_id,creator\.company_id\)=u\.company_id/);
assert.match(repository, /assertCanonicalIssueScope/);
assert.match(repository, /JOIN files file ON file\.id=evidence\.file_id/);
assert.match(repository, /status='approved'/, "project-facing guidance must be approved");
assert.match(repository, /status\s*<>\s*'retired'/, "retired records must not be selectable");
assert.match(taxonomy, /WHERE base\.company_id=\$1/, "taxonomy access must remain company scoped");
assert.match(route, /resolved\.capabilities\.has\("view_draft"\)/, "draft visibility must be server-authorized");
assert.match(route, /action==="approve"\?"approve"/, "approval identity must be resolved server-side");
assert.match(route, /context\(req,"manage_taxonomy"\)/, "taxonomy writes must require company authority");

console.log(`Build 271 Coordination Knowledge security: PASS endpoints=${routeDeclarations.length} tenant=deny project=deny escalation=deny draft=guarded attachments=guarded retired=guarded`);
