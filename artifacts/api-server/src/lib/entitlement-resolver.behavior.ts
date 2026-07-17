import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ENTITLEMENT_EXPLANATIONS, resolveEntitlement, validateCatalogFeature, type CatalogFeature, type EntitlementDecision } from "./entitlement-contract";
import { initialFeature, INITIAL_FEATURE_CATALOG } from "./initial-feature-catalog";
import { CURRENT_PROJECT_ROLES, LEGACY_PROJECT_ROLE_ALIASES, mapCurrentProjectRole } from "./scoped-authority";

const root = path.resolve(process.cwd(), "../..");
const checks: { number: number; name: string; evidence: string }[] = [];
function check(number: number, name: string, fn: () => string): void {
  checks.push({ number, name, evidence: fn() });
}
const get = (key: string): CatalogFeature => {
  const item = initialFeature(key);
  assert.ok(item, `missing seed ${key}`);
  return item;
};
const active = { project: { requested: true, membership: "active" as const, role: "member", permissionCategory: "write" } };
const code = (decision: EntitlementDecision, expected: string): string => { assert.equal(decision.code, expected); return `${decision.decision}:${decision.code}`; };

check(1, "available capability resolves truthfully", () => code(resolveEntitlement(get("rfi.core"), active), "ENT_AVAILABLE"));
check(2, "coming-later cannot execute", () => code(resolveEntitlement(get("geotwin_bim_10d")), "ENT_COMING_LATER"));
check(3, "preview returns preview", () => { const d=resolveEntitlement(get("concierge.proactive")); assert.equal(d.decision,"preview"); return code(d,"ENT_PREVIEW_ONLY"); });
check(4, "platform suspension dominates lower grants", () => code(resolveEntitlement(get("rfi.core"), { ...active, platform:{status:"suspended",version:2}, commercial:{configured:true,tierIncluded:true} }), "ENT_TEMP_SUSPENDED"));
check(5, "deprecated replacement explanation", () => { const f={...get("rfi.core"),capabilityStatus:"deprecated" as const,replacementFeatureKey:"rfi.core.v2",deprecationExplanation:{en:"Use the verified replacement.",es:"Use el reemplazo verificado."}}; const d=resolveEntitlement(f); assert.equal(d.explanation.es,f.deprecationExplanation.es); return code(d,"ENT_DEPRECATED"); });
check(6, "inactive membership denied", () => code(resolveEntitlement(get("rfi.core"), { project:{requested:true,membership:"inactive",role:"member",permissionCategory:"write"} }), "ENT_ROLE_RESTRICTED"));
check(7, "missing membership denied", () => code(resolveEntitlement(get("rfi.core"), { project:{requested:true,membership:"missing"} }), "ENT_ROLE_RESTRICTED"));
check(8, "active membership reaches scoped role", () => { const f={...get("rfi.core"),requiredScopedAuthorities:["project:admin"]}; const denied=resolveEntitlement(f,active); assert.equal(denied.state,"scoped_role_restricted"); const allowed=resolveEntitlement(f,{project:{requested:true,membership:"active",role:"project_admin",permissionCategory:"admin"}}); return code(allowed,"ENT_AVAILABLE"); });
check(9, "preference restricts but never grants", () => { const f={...get("notifications.deterministic"),capabilityStatus:"available" as const,supportsUserPreference:true,preferenceKey:"test.optional"}; assert.equal(resolveEntitlement(f,{...active,userPreference:{enabled:false,version:1}}).code,"ENT_USER_DISABLED"); const denied=resolveEntitlement(f,{...active,platform:{status:"suspended",version:2},userPreference:{enabled:true,version:2}}); return code(denied,"ENT_TEMP_SUSPENDED"); });
check(10, "missing commercial authority is explicit", () => { const f={...get("rfi.core"),commercialAuthority:"tier" as const}; return code(resolveEntitlement(f,active),"ENT_COMMERCIAL_AUTHORITY_NOT_CONFIGURED"); });
check(11, "deterministic notification is zero AI", () => { const f=get("notifications.deterministic"); assert.equal(f.aiClassification,"deterministic_automation"); assert.equal(f.meteringPolicyKey,"zero_ai_credits"); return "deterministic_automation:zero_ai_credits"; });
check(12, "AI classifications remain distinct", () => { assert.equal(get("telegram.assistant").aiClassification,"text_ai"); assert.equal(get("ai.file_reading_control").aiClassification,"file_reading_ai"); assert.equal(get("concierge.proactive").aiClassification,"proactive_ai"); return "text_ai,file_reading_ai,proactive_ai"; });
check(13, "file-reading control needs exact confirmation", () => { const f=get("ai.file_reading_control"); const d=resolveEntitlement(f,active); assert.deepEqual(d.confirmations,["confirm_ai_estimate","confirm_files_and_scope"]); return code(d,"ENT_CONFIRMATION_REQUIRED"); });
check(14, "external delivery needs exact recipients", () => { const f=get("telegram.delivery_concierge"); const d=resolveEntitlement(f,active); assert.ok(d.confirmations?.includes("confirm_exact_recipients")); return code(d,"ENT_CONFIRMATION_REQUIRED"); });
check(15, "bilingual explanations are complete", () => { for(const f of INITIAL_FEATURE_CATALOG){assert.ok(f.name.en&&f.name.es&&f.description.en&&f.description.es);assert.doesNotMatch(JSON.stringify(f),/\u00c3|\u00c2|\u00e2\u20ac/);} for(const value of Object.values(ENTITLEMENT_EXPLANATIONS)){assert.ok(value.en&&value.es);} return `${INITIAL_FEATURE_CATALOG.length} catalog entries and ${Object.keys(ENTITLEMENT_EXPLANATIONS).length} templates`; });
check(16, "resolver is mutation-free", () => { const f=structuredClone(get("rfi.core")); const ctx=structuredClone(active); const before=JSON.stringify({f,ctx}); resolveEntitlement(f,ctx); assert.equal(JSON.stringify({f,ctx}),before); return "inputs unchanged"; });

const migration = fs.readFileSync(path.join(root,"artifacts/api-server/src/lib/feature-catalog-migration.ts"),"utf8");
const routes = fs.readFileSync(path.join(root,"artifacts/api-server/src/routes/features.ts"),"utf8");
const admin = fs.readFileSync(path.join(root,"artifacts/api-server/src/routes/admin.ts"),"utf8");
const service = fs.readFileSync(path.join(root,"artifacts/api-server/src/lib/feature-catalog-service.ts"),"utf8");
check(17, "activated versions cannot be edited", () => { assert.match(migration,/immutable_after_activation/); assert.match(migration,/BEFORE UPDATE OR DELETE ON feature_catalog_versions/); return "database immutability trigger present"; });
check(18, "new version supersedes without destroying history", () => { assert.match(migration,/UNIQUE\(feature_key,version\)/); assert.match(service,/ORDER BY v\.feature_key,v\.version DESC/); return "version journal and effective projection present"; });
check(19, "project administrators cannot mutate platform state", () => { assert.match(routes,/platform-capabilities.*authMiddleware, isSuperAdminMiddleware/); return "route requires current super-admin middleware"; });
check(20, "platform mutation rechecks authority", () => { assert.match(service,/SELECT is_super_admin FROM users WHERE id=\$1 FOR SHARE/); assert.match(admin,/isSuperAdminMiddleware/); return "database authority recheck present"; });
check(21, "responses are sanitized", () => { const samples=INITIAL_FEATURE_CATALOG.flatMap(f=>[f.description.en,f.description.es]); for(const value of [...samples,...Object.values(ENTITLEMENT_EXPLANATIONS).flatMap(v=>[v.en,v.es])]) assert.doesNotMatch(value,/SELECT |INSERT |UPDATE |DELETE |password|secret|stack|customer[_ -]?id/i); return "controlled catalog and template text"; });
check(22, "AI control-plane adapter result is preserved", () => { const d=resolveEntitlement(get("telegram.assistant"),{...active,aiControl:{allowed:false,code:"ENT_ALLOWANCE_EXHAUSTED",state:"ai_budget_exhausted",version:7,allowance:{unit:"micros",remaining:"0",requested:"1"}}}); assert.equal(d.state,"ai_budget_exhausted"); assert.ok(d.sources.some(s=>s.authority==="ai_control_plane"&&s.version===7)); return code(d,"ENT_ALLOWANCE_EXHAUSTED"); });
check(23, "legacy GET is non-mutating", () => { assert.doesNotMatch(admin.slice(admin.indexOf('router.get("/admin/feature-flags"'),admin.indexOf('router.patch("/admin/feature-flags')),/insert\(|update\(|delete\(/i); return "read-only legacy projection"; });
check(24, "preview and future capabilities cannot execute", () => { for(const f of INITIAL_FEATURE_CATALOG.filter(x=>x.capabilityStatus!=="available")) assert.notEqual(resolveEntitlement(f).decision,"allow"); return "all non-available seeds blocked"; });
check(25, "migration is additive", () => { assert.doesNotMatch(migration,/DROP\s+(TABLE|COLUMN|INDEX)/i); return "no destructive DDL"; });

check(26, "Project Admin maps to admin/write/read", () => { const m=mapCurrentProjectRole("project_admin","admin"); assert.ok(m.authorities.includes("project:admin")&&m.authorities.includes("project:write")&&m.authorities.includes("project:read")); return m.authorities.join(","); });
check(27, "Convention Manager cannot become Project Admin", () => { const m=mapCurrentProjectRole("convention_manager","write"); assert.ok(m.authorities.includes("convention:manage")&&!m.authorities.includes("project:admin")); return m.authorities.join(","); });
check(28, "Discipline Lead has bounded write authority", () => { const m=mapCurrentProjectRole("discipline_lead","write"); assert.ok(m.authorities.includes("discipline:lead")&&m.authorities.includes("project:write")&&!m.authorities.includes("project:admin")); return m.authorities.join(","); });
check(29, "Member has write but no admin authority", () => { const m=mapCurrentProjectRole("member","write"); assert.ok(m.authorities.includes("project:write")&&!m.authorities.includes("project:admin")); return m.authorities.join(","); });
check(30, "Sub-trade has limited upload but no generic write", () => { const m=mapCurrentProjectRole("sub_trade","write"); assert.ok(m.authorities.includes("coordination:upload")&&!m.authorities.includes("project:write")); return m.authorities.join(","); });
check(31, "Read Only cannot write", () => { const m=mapCurrentProjectRole("read_only","read"); assert.deepEqual(m.authorities,["project:read"]); return m.authorities.join(","); });
check(32, "unknown role denies safely", () => { const m=mapCurrentProjectRole("future_unknown","admin"); assert.equal(m.knownRole,false); assert.deepEqual(m.authorities,[]); return "unknown:deny"; });
check(33, "permission metadata may restrict but not broaden", () => { const m=mapCurrentProjectRole("member","read"); assert.deepEqual(m.authorities,["project:read"]); return "member constrained to read"; });
check(34, "all six integrated roles are inventoried", () => { assert.deepEqual(CURRENT_PROJECT_ROLES,["project_admin","convention_manager","discipline_lead","member","sub_trade","read_only"]); return CURRENT_PROJECT_ROLES.join(","); });
check(35, "trusted internal confirmation is bounded and explicit", () => { const f=get("ai.file_reading_control"); const allowed=resolveEntitlement(f,{...active,trustedConfirmations:["confirm_ai_estimate","confirm_files_and_scope"]}); assert.equal(allowed.decision,"allow"); const invalid=resolveEntitlement(f,{...active,trustedConfirmations:["bad control"]}); return code(invalid,"ENT_UNAVAILABLE"); });
check(36, "decisions are advisory and cannot authorize execution", () => { const d=resolveEntitlement(get("rfi.core"),active); assert.deepEqual(d.evaluation,{mode:"advisory_read_only",authorizesExecution:false}); return d.evaluation.mode; });
check(37, "overstated generic capabilities are not available", () => { assert.equal(get("notifications.deterministic").capabilityStatus,"coming_later"); assert.equal(get("concierge.click_driven").capabilityStatus,"coming_later"); assert.match(get("ai.file_reading_control").description.en,/classification only/i); return "truth states corrected"; });
check(38, "missing permission metadata denies safely", () => { const m=mapCurrentProjectRole("member",null); assert.deepEqual(m.authorities,[]); return "missing metadata:deny"; });
check(39, "legacy admin maps to bounded Project Admin authority", () => { const m=mapCurrentProjectRole("admin","admin"); assert.ok(m.authorities.includes("project:admin")); return "admin->project:admin"; });
check(40, "legacy viewer remains read only", () => { const m=mapCurrentProjectRole("viewer","read"); assert.deepEqual(m.authorities,["project:read"]); assert.deepEqual(LEGACY_PROJECT_ROLE_ALIASES,["admin","viewer"]); return "viewer->project:read"; });
check(41, "catalog strings and arrays are bounded", () => { assert.equal(validateCatalogFeature({...get("rfi.core"),description:{en:"x".repeat(1001),es:"válido"}}),false); assert.equal(validateCatalogFeature({...get("rfi.core"),tierAvailability:Array(33).fill("tier")}),false); return "oversized catalog data rejected"; });

console.log(JSON.stringify({ suite:"canonical-entitlement-resolver", passed:checks.length, checks },null,2));
