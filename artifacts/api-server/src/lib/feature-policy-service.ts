import crypto from "crypto";
import { pool } from "@workspace/db";
import type { CatalogFeature, ResolverContext } from "./entitlement-contract";
import { FEATURE_KEY_PATTERN } from "./entitlement-contract";
import { getEffectiveFeature, listEffectiveCatalog } from "./feature-catalog-service";
import { waitForFeaturePolicyMigration } from "./feature-policy-migration";
import { hasScopedAuthority, mapCurrentProjectRole } from "./scoped-authority";

export type PolicyDecision = "enabled" | "disabled" | "inherit";
export type PolicyScope = "company" | "project" | "user";
export class FeaturePolicyError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string, public readonly messageEs: string) { super(message); }
}

type Actor = { userId: number; companyId: number; isSuperAdmin: boolean };
type PolicyRow = { decision: PolicyDecision; version: number; configuration: Record<string, unknown>; explanation: { en: string; es: string } };
type ProjectBinding = { id: string; projectId: number; companyId: number; version: number; createdAt: string };
const plainObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const control = /[\u0000-\u001f\u007f]/;
const secretKey = /(secret|password|credential|private.?key|api.?key|access.?token|refresh.?token)/i;
const tenantKey = /^(company|project|user|tenant)_?id$/i;
const reasonPattern = /^[A-Z][A-Z0-9_]{2,79}$/;

const boundedText = (value: unknown, max = 1000): value is string => typeof value === "string" && value.trim().length > 0 && value.trim().length <= max && !control.test(value);
const date = (value: unknown, fallback: Date): Date => {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) throw new FeaturePolicyError(400,"EFFECTIVE_DATE_INVALID","Effective dates are invalid.","Las fechas de vigencia no son válidas.");
  return parsed;
};

function validateValue(value: unknown, depth: number): void {
  if (depth > 3) throw new FeaturePolicyError(400,"POLICY_CONFIGURATION_TOO_DEEP","Policy configuration is too deeply nested.","La configuración de política tiene demasiados niveles.");
  if (typeof value === "string") {
    if (value.length > 200 || control.test(value)) throw new FeaturePolicyError(400,"POLICY_CONFIGURATION_INVALID","Policy text must be bounded plain text.","El texto de la política debe ser texto simple y limitado.");
    if (/^https?:\/\//i.test(value)) throw new FeaturePolicyError(400,"POLICY_UNSAFE_URL","URLs are not accepted in feature policy configuration.","No se aceptan URL en la configuración de políticas.");
    return;
  }
  if (typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) return;
  if (Array.isArray(value)) {
    if (value.length > 10) throw new FeaturePolicyError(400,"POLICY_CONFIGURATION_TOO_LARGE","Policy arrays are limited to 10 items.","Las matrices de política se limitan a 10 elementos.");
    value.forEach((item) => validateValue(item, depth + 1)); return;
  }
  if (plainObject(value)) {
    const entries = Object.entries(value);
    if (entries.length > 8) throw new FeaturePolicyError(400,"POLICY_CONFIGURATION_TOO_LARGE","Policy objects are limited to 8 keys.","Los objetos de política se limitan a 8 claves.");
    for (const [key, item] of entries) {
      if (key.length > 60 || control.test(key) || secretKey.test(key) || tenantKey.test(key)) throw new FeaturePolicyError(400,"POLICY_CONFIGURATION_KEY_INVALID","Policy configuration contains an unsafe key.","La configuración de política contiene una clave no segura.");
      validateValue(item, depth + 1);
    }
    return;
  }
  throw new FeaturePolicyError(400,"POLICY_CONFIGURATION_INVALID","Policy configuration contains an unsupported value.","La configuración de política contiene un valor no compatible.");
}

export function validatePolicyConfiguration(feature: CatalogFeature, value: unknown): Record<string, unknown> {
  if (!plainObject(value)) throw new FeaturePolicyError(400,"POLICY_CONFIGURATION_INVALID","Policy configuration must be an object.","La configuración de política debe ser un objeto.");
  const serialized = JSON.stringify(value);
  if (serialized.length > 2000) throw new FeaturePolicyError(400,"POLICY_CONFIGURATION_TOO_LARGE","Policy configuration is too large.","La configuración de política es demasiado grande.");
  for (const key of Object.keys(value)) if (!feature.policyConfigurationKeys.includes(key)) {
    throw new FeaturePolicyError(400,"POLICY_CONFIGURATION_UNSUPPORTED","This feature does not support that configuration key.","Esta función no admite esa clave de configuración.");
  }
  validateValue(value, 0);
  return structuredClone(value);
}

async function actorFor(userId: number): Promise<Actor> {
  const result = await pool.query(`SELECT id,company_id,is_super_admin FROM users WHERE id=$1 LIMIT 1`,[userId]);
  const row=result.rows[0];
  if(!row) throw new FeaturePolicyError(401,"AUTHORITY_INVALID","Current database authority could not be verified.","No se pudo verificar la autoridad actual en la base de datos.");
  return {userId:Number(row.id),companyId:Number(row.company_id),isSuperAdmin:row.is_super_admin===true};
}

async function hasCompanyGrant(actor: Actor): Promise<boolean> {
  const result=await pool.query(`SELECT 1 FROM company_policy_authority_grants g
    WHERE g.company_id=$1 AND g.user_id=$2 AND g.effective_from<=now() AND (g.effective_to IS NULL OR g.effective_to>now())
    AND NOT EXISTS(SELECT 1 FROM company_policy_authority_revocations r WHERE r.grant_id=g.id) LIMIT 1`,[actor.companyId,actor.userId]);
  return Boolean(result.rows[0]);
}

async function currentProjectBinding(projectId: number): Promise<ProjectBinding> {
  if(!Number.isSafeInteger(projectId)||projectId<=0)throw new FeaturePolicyError(400,"PROJECT_CONTEXT_INVALID","projectId must be a positive integer.","projectId debe ser un entero positivo.");
  const result=await pool.query(`SELECT id,project_id,company_id,version,created_at FROM project_company_binding_versions WHERE project_id=$1 ORDER BY version DESC LIMIT 1`,[projectId]);
  const row=result.rows[0];
  if(!row)throw new FeaturePolicyError(409,"PROJECT_COMPANY_BINDING_REQUIRED","This legacy project requires an explicit audited company binding before policy administration.","Este proyecto heredado requiere una vinculación de empresa explícita y auditada antes de administrar políticas.");
  return{id:String(row.id),projectId:Number(row.project_id),companyId:Number(row.company_id),version:Number(row.version),createdAt:new Date(row.created_at).toISOString()};
}

async function projectAuthority(actor: Actor, projectId: number, requireAdmin: boolean): Promise<{ role: string; permission: string | null }> {
  const binding=await currentProjectBinding(projectId);
  if(binding.companyId!==actor.companyId)throw new FeaturePolicyError(403,"CROSS_PROJECT_FORBIDDEN","Project policy access is outside your current company scope.","El acceso a la política del proyecto está fuera del alcance de su empresa actual.");
  const result=await pool.query(`SELECT pm.role,pm.status,co.meta
    FROM projects p
    LEFT JOIN project_members pm ON pm.project_id=p.id AND pm.user_id=$2
    LEFT JOIN config_options co ON co.category='member_role' AND co.value=pm.role
    WHERE p.id=$1 LIMIT 1`,[projectId,actor.userId]);
  const row=result.rows[0];
  if(!row) throw new FeaturePolicyError(404,"PROJECT_NOT_FOUND","Project not found.","No se encontró el proyecto.");
  if(row.status!=="active") throw new FeaturePolicyError(403,"PROJECT_MEMBERSHIP_INACTIVE","Active project membership is required.","Se requiere membresía activa en el proyecto.");
  const meta=plainObject(row.meta)?row.meta:null;
  const permission=typeof meta?.permission==="string"?meta.permission:row.role==="admin"?"admin":row.role==="viewer"?"read":null;
  const mapping=mapCurrentProjectRole(row.role,permission);
  if(requireAdmin&&(!mapping.knownRole||!hasScopedAuthority(mapping,["project:admin"]))) throw new FeaturePolicyError(403,"PROJECT_POLICY_ADMIN_REQUIRED","Current project configuration authority is required.","Se requiere autoridad actual de configuración del proyecto.");
  return {role:String(row.role),permission};
}

const policySupport = (feature: CatalogFeature, scope: PolicyScope): boolean => scope==="company"?feature.supportsCompanyPolicy:scope==="project"?feature.supportsProjectPolicy:feature.supportsUserPreference;
async function featureForPolicy(featureKey:string,scope:PolicyScope):Promise<CatalogFeature>{
  if(!FEATURE_KEY_PATTERN.test(featureKey))throw new FeaturePolicyError(400,"FEATURE_KEY_INVALID","Feature key is invalid.","La clave de función no es válida.");
  const feature=await getEffectiveFeature(featureKey);
  if(!feature)throw new FeaturePolicyError(404,"FEATURE_NOT_FOUND","Feature not found.","No se encontró la función.");
  if(!policySupport(feature,scope))throw new FeaturePolicyError(400,"POLICY_SCOPE_UNSUPPORTED","This feature does not support the requested policy scope.","Esta función no admite el alcance de política solicitado.");
  return feature;
}

async function effectivePolicy(scope:PolicyScope,featureKey:string,companyId:number,projectId?:number,userId?:number,at=new Date()):Promise<PolicyRow|undefined>{
  const field=scope==="company"?"company_id":scope==="project"?"project_id":"user_id";
  const value=scope==="company"?companyId:scope==="project"?projectId:userId;
  const result=await pool.query(`SELECT decision,version,configuration,explanation_en,explanation_es FROM feature_policy_versions
    WHERE scope_type=$1 AND ${field}=$2 AND feature_key=$3 AND effective_from<=$4 AND (effective_to IS NULL OR effective_to>$4)
    ORDER BY version DESC LIMIT 1`,[scope,value,featureKey,at]);
  const row=result.rows[0];
  return row?{decision:row.decision,version:Number(row.version),configuration:plainObject(row.configuration)?row.configuration:{},explanation:{en:String(row.explanation_en),es:String(row.explanation_es)}}:undefined;
}

export async function policyContext(input:{feature:CatalogFeature;userId:number;companyId:number;projectId?:number;at?:Date}):Promise<Pick<ResolverContext,"companyPolicy"|"projectPolicy"|"userPreference"> & {inheritancePath:string[];configuration:Record<string,unknown>}>{
  await waitForFeaturePolicyMigration();
  const at=input.at??new Date();
  const company=input.feature.supportsCompanyPolicy?await effectivePolicy("company",input.feature.featureKey,input.companyId,undefined,undefined,at):undefined;
  const project=input.projectId!==undefined&&input.feature.supportsProjectPolicy?await effectivePolicy("project",input.feature.featureKey,input.companyId,input.projectId,undefined,at):undefined;
  const user=input.feature.supportsUserPreference?await effectivePolicy("user",input.feature.featureKey,input.companyId,undefined,input.userId,at):undefined;
  const defaultUser:PolicyDecision=input.feature.aiClassification==="proactive_ai"?"disabled":"inherit";
  return {
    companyPolicy:company&&{decision:company.decision,version:company.version,configuration:company.configuration},
    projectPolicy:project&&{decision:project.decision,version:project.version,configuration:project.configuration},
    userPreference:{decision:user?.decision??defaultUser,version:user?.version??0},
    inheritancePath:[`company:${company?.decision??"inherit"}`,`project:${project?.decision??"inherit"}`,`user:${user?.decision??defaultUser}`],
    configuration:{...(company?.configuration??{}),...(project?.configuration??{})},
  };
}

export async function listEffectivePolicies(input:{scope:"company"|"project";userId:number;projectId?:number}):Promise<{policies:Record<string,unknown>[];administrative:boolean}> {
  await waitForFeaturePolicyMigration(); const actor=await actorFor(input.userId);
  if(input.scope==="project")await projectAuthority(actor,Number(input.projectId),false);
  const administrative=input.scope==="company"?await hasCompanyGrant(actor):(await projectAuthority(actor,Number(input.projectId),false),await projectAuthority(actor,Number(input.projectId),true).then(()=>true).catch(()=>false));
  const catalog=await listEffectiveCatalog(); const rows=[] as Record<string,unknown>[];
  for(const feature of catalog){if(!policySupport(feature,input.scope))continue;const policy=await effectivePolicy(input.scope,feature.featureKey,actor.companyId,input.projectId);const base={featureKey:feature.featureKey,name:feature.name,availability:feature.capabilityStatus,effectiveDecision:policy?.decision??"inherit",readOnly:true};rows.push(administrative?{...base,decision:policy?.decision??"inherit",version:policy?.version??0,explanation:policy?.explanation??feature.previewUpgradeExplanation,configuration:policy?.configuration??{}}:{...base,explanation:{en:"This is the effective advisory state. Administrative configuration and audit details require current policy authority.",es:"Este es el estado consultivo efectivo. La configuración y auditoría administrativas requieren autoridad de política vigente."}});}
  return{policies:rows,administrative};
}

export async function listCurrentUserPreferences(userId:number):Promise<Record<string,unknown>[]> {
  await waitForFeaturePolicyMigration(); const actor=await actorFor(userId); const catalog=await listEffectiveCatalog(); const rows=[] as Record<string,unknown>[];
  for(const feature of catalog){if(!feature.supportsUserPreference||!feature.preferenceKey)continue;const policy=await effectivePolicy("user",feature.featureKey,actor.companyId,undefined,actor.userId);const defaultDecision:PolicyDecision=feature.aiClassification==="proactive_ai"?"disabled":"inherit";const company=feature.supportsCompanyPolicy?await effectivePolicy("company",feature.featureKey,actor.companyId):undefined;const effectiveDecision=company?.decision==="disabled"?"disabled":policy?.decision==="disabled"?"disabled":policy?.decision==="enabled"?"enabled":"enabled";rows.push({featureKey:feature.featureKey,name:feature.name,description:feature.description,availability:feature.capabilityStatus,aiClassification:feature.aiClassification,confirmationRequirements:feature.confirmationRequirements,decision:policy?.decision??defaultDecision,effectiveDecision,effectiveSource:company?.decision==="disabled"?"company":"default",version:policy?.version??0,defaultBehavior:feature.aiClassification==="proactive_ai"?"explicit_opt_in":"included_click_driven",optOutGuidance:{en:"On never overrides a higher denial, and saving never runs anything.",es:"Activado nunca anula una denegación superior y guardar nunca ejecuta nada."}});}
  return rows;
}

type CreatePolicyInput={scope:PolicyScope;featureKey:string;actorUserId:number;projectId?:number;decision:PolicyDecision;configuration:unknown;expectedVersion?:number;reasonCode:string;explanation:{en:string;es:string};effectiveFrom?:unknown;effectiveTo?:unknown};
export async function createPolicyVersion(input:CreatePolicyInput):Promise<Record<string,unknown>>{
  await waitForFeaturePolicyMigration(); const actor=await actorFor(input.actorUserId); const feature=await featureForPolicy(input.featureKey,input.scope);
  if(!(["enabled","disabled","inherit"] as string[]).includes(input.decision))throw new FeaturePolicyError(400,"POLICY_DECISION_INVALID","Policy decision is invalid.","La decisión de política no es válida.");
  if(!reasonPattern.test(input.reasonCode)||!boundedText(input.explanation.en)||!boundedText(input.explanation.es))throw new FeaturePolicyError(400,"POLICY_EXPLANATION_INVALID","A bounded reason code and bilingual explanation are required.","Se requiere un código de motivo limitado y una explicación bilingüe.");
  if(input.decision==="enabled"&&feature.capabilityStatus!=="available")throw new FeaturePolicyError(409,"POLICY_CANNOT_ENABLE_UNAVAILABLE","Preview and coming-later features cannot be enabled.","Las funciones de vista previa o disponibles más adelante no se pueden habilitar.");
  const configuration=validatePolicyConfiguration(feature,input.configuration??{});if(feature.capabilityStatus!=="available"&&Object.keys(configuration).length>0)throw new FeaturePolicyError(409,"POLICY_CONFIGURATION_UNAVAILABLE","Configuration is unavailable until the feature is operational.","La configuración no está disponible hasta que la función esté operativa."); const from=date(input.effectiveFrom,new Date());const to=input.effectiveTo==null?null:date(input.effectiveTo,new Date());if(to&&to<=from)throw new FeaturePolicyError(400,"EFFECTIVE_DATE_INVALID","effectiveTo must be after effectiveFrom.","effectiveTo debe ser posterior a effectiveFrom.");
  if(input.scope==="company"&&!await hasCompanyGrant(actor))throw new FeaturePolicyError(403,"COMPANY_POLICY_AUTHORITY_REQUIRED","An active transitional Company Administrator policy grant is required.","Se requiere una concesión transitoria activa de Administrador de Empresa para políticas.");
  if(input.scope==="project"){await projectAuthority(actor,Number(input.projectId),true);const binding=await currentProjectBinding(Number(input.projectId));const company=await effectivePolicy("company",feature.featureKey,binding.companyId);if(input.decision==="enabled"&&company?.decision==="disabled")throw new FeaturePolicyError(409,"COMPANY_POLICY_CONFLICT","A project policy cannot enable a company-disabled feature.","Una política de proyecto no puede habilitar una función desactivada por la empresa.");}
  if(input.scope==="user"&&actor.userId!==input.actorUserId)throw new FeaturePolicyError(403,"USER_POLICY_FORBIDDEN","Users may update only their own preferences.","Los usuarios solo pueden actualizar sus propias preferencias.");
  const client=await pool.connect();try{await client.query("BEGIN");const fresh=await client.query(`SELECT company_id FROM users WHERE id=$1 FOR SHARE`,[actor.userId]);if(Number(fresh.rows[0]?.company_id)!==actor.companyId)throw new FeaturePolicyError(403,"AUTHORITY_CHANGED","Current authority changed.","La autoridad actual cambió.");if(input.scope==="company"){const grant=await client.query(`SELECT 1 FROM company_policy_authority_grants g WHERE g.company_id=$1 AND g.user_id=$2 AND g.effective_from<=now() AND (g.effective_to IS NULL OR g.effective_to>now()) AND NOT EXISTS(SELECT 1 FROM company_policy_authority_revocations r WHERE r.grant_id=g.id) FOR SHARE OF g`,[actor.companyId,actor.userId]);if(!grant.rows[0])throw new FeaturePolicyError(403,"COMPANY_POLICY_AUTHORITY_REQUIRED","Company policy authority was revoked.","La autoridad de política de empresa fue revocada.");}if(input.scope==="project"){const authority=await client.query(`SELECT pm.role,pm.status,co.meta,b.company_id AS bound_company_id FROM projects p JOIN LATERAL(SELECT company_id FROM project_company_binding_versions WHERE project_id=p.id ORDER BY version DESC LIMIT 1)b ON true JOIN project_members pm ON pm.project_id=p.id AND pm.user_id=$2 LEFT JOIN config_options co ON co.category='member_role' AND co.value=pm.role WHERE p.id=$1 FOR SHARE OF p,pm`,[Number(input.projectId),actor.userId]);const row=authority.rows[0],meta=plainObject(row?.meta)?row.meta:null,permission=typeof meta?.permission==="string"?meta.permission:null,mapping=mapCurrentProjectRole(row?.role,permission);if(!row||Number(row.bound_company_id)!==actor.companyId||row.status!=="active"||!mapping.knownRole||!hasScopedAuthority(mapping,["project:admin"]))throw new FeaturePolicyError(403,"PROJECT_POLICY_ADMIN_REQUIRED","Current project configuration authority is required.","Se requiere autoridad actual de configuración del proyecto.");}
    const scopeValue=input.scope==="company"?actor.companyId:input.scope==="project"?Number(input.projectId):actor.userId;await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`,[`${input.scope}:${scopeValue}:${feature.featureKey}`]);const field=input.scope==="company"?"company_id":input.scope==="project"?"project_id":"user_id";const current=await client.query(`SELECT id,version FROM feature_policy_versions WHERE scope_type=$1 AND ${field}=$2 AND feature_key=$3 ORDER BY version DESC LIMIT 1`,[input.scope,scopeValue,feature.featureKey]);const currentVersion=Number(current.rows[0]?.version??0);if(input.expectedVersion!==undefined&&input.expectedVersion!==currentVersion)throw new FeaturePolicyError(409,"POLICY_VERSION_CONFLICT","The policy changed; reload before saving.","La política cambió; vuelva a cargar antes de guardar.");const version=currentVersion+1;const id=crypto.randomUUID();const result=await client.query(`INSERT INTO feature_policy_versions(id,scope_type,feature_key,company_id,project_id,user_id,decision,configuration,version,effective_from,effective_to,actor_user_id,reason_code,explanation_en,explanation_es,supersedes_version_id,audit_evidence) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb) RETURNING feature_key,scope_type,decision,version,effective_from,effective_to`,[id,input.scope,feature.featureKey,actor.companyId,input.scope==="project"?Number(input.projectId):null,input.scope==="user"?actor.userId:null,input.decision,JSON.stringify(configuration),version,from,to,actor.userId,input.reasonCode,input.explanation.en.trim(),input.explanation.es.trim(),current.rows[0]?.id??null,JSON.stringify({source:"authenticated_policy_api"})]);await client.query("COMMIT");const row=result.rows[0];return{featureKey:row.feature_key,scopeType:row.scope_type,decision:row.decision,version:Number(row.version),effectiveFrom:new Date(row.effective_from).toISOString(),effectiveTo:row.effective_to?new Date(row.effective_to).toISOString():null};
  }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
}

export async function createCompanyPolicyGrant(input:{actorUserId:number;companyId:number;userId:number;reasonCode:string;explanation:{en:string;es:string};effectiveFrom?:unknown;effectiveTo?:unknown}):Promise<Record<string,unknown>>{
  await waitForFeaturePolicyMigration();const actor=await actorFor(input.actorUserId);if(!actor.isSuperAdmin)throw new FeaturePolicyError(403,"SUPER_ADMIN_REQUIRED","Verified super-admin authority is required to manage grant metadata.","Se requiere autoridad verificada de superadministrador para administrar los metadatos de concesión.");if(!reasonPattern.test(input.reasonCode)||!boundedText(input.explanation.en)||!boundedText(input.explanation.es))throw new FeaturePolicyError(400,"POLICY_EXPLANATION_INVALID","Bounded bilingual grant evidence is required.","Se requiere evidencia bilingüe limitada para la concesión.");const target=await pool.query(`SELECT id FROM users WHERE id=$1 AND company_id=$2`,[input.userId,input.companyId]);if(!target.rows[0])throw new FeaturePolicyError(403,"CROSS_COMPANY_FORBIDDEN","Grant target must belong to the selected company.","El destinatario de la concesión debe pertenecer a la empresa seleccionada.");const from=date(input.effectiveFrom,new Date()),to=input.effectiveTo==null?null:date(input.effectiveTo,new Date());if(to&&to<=from)throw new FeaturePolicyError(400,"EFFECTIVE_DATE_INVALID","Grant end must follow its start.","El fin de la concesión debe ser posterior a su inicio.");const id=crypto.randomUUID();await pool.query(`INSERT INTO company_policy_authority_grants(id,company_id,user_id,effective_from,effective_to,granted_by_id,reason_code,explanation_en,explanation_es,audit_evidence) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,[id,input.companyId,input.userId,from,to,actor.userId,input.reasonCode,input.explanation.en.trim(),input.explanation.es.trim(),JSON.stringify({source:"verified_super_admin_grant"})]);return{grant:"created",grantId:id,effectiveFrom:from.toISOString(),effectiveTo:to?.toISOString()??null};
}

export async function listCompanyPolicyGrantMetadata(actorUserId:number,companyId:number):Promise<Record<string,unknown>[]>{await waitForFeaturePolicyMigration();const actor=await actorFor(actorUserId);if(!actor.isSuperAdmin)throw new FeaturePolicyError(403,"SUPER_ADMIN_REQUIRED","Verified super-admin authority is required.","Se requiere autoridad verificada de superadministrador.");if(!Number.isSafeInteger(companyId)||companyId<=0)throw new FeaturePolicyError(400,"COMPANY_SCOPE_INVALID","companyId must be a positive integer.","companyId debe ser un entero positivo.");const result=await pool.query(`SELECT g.id,g.effective_from,g.effective_to,g.reason_code,g.created_at,r.created_at AS revoked_at FROM company_policy_authority_grants g LEFT JOIN company_policy_authority_revocations r ON r.grant_id=g.id WHERE g.company_id=$1 ORDER BY g.created_at DESC LIMIT 200`,[companyId]);return result.rows.map(row=>({grantId:row.id,status:row.revoked_at?"revoked":"active",effectiveFrom:new Date(row.effective_from).toISOString(),effectiveTo:row.effective_to?new Date(row.effective_to).toISOString():null,reasonCode:row.reason_code,createdAt:new Date(row.created_at).toISOString(),revokedAt:row.revoked_at?new Date(row.revoked_at).toISOString():null,metadataOnly:true}));}

export async function revokeCompanyPolicyGrant(input:{actorUserId:number;grantId:string;reasonCode:string;explanation:{en:string;es:string}}):Promise<{revoked:true}>{await waitForFeaturePolicyMigration();const actor=await actorFor(input.actorUserId);if(!actor.isSuperAdmin)throw new FeaturePolicyError(403,"SUPER_ADMIN_REQUIRED","Verified super-admin authority is required.","Se requiere autoridad verificada de superadministrador.");if(!reasonPattern.test(input.reasonCode)||!boundedText(input.explanation.en)||!boundedText(input.explanation.es))throw new FeaturePolicyError(400,"POLICY_EXPLANATION_INVALID","Bounded bilingual revocation evidence is required.","Se requiere evidencia bilingüe limitada para la revocación.");const found=await pool.query(`SELECT 1 FROM company_policy_authority_grants WHERE id=$1`,[input.grantId]);if(!found.rows[0])throw new FeaturePolicyError(404,"GRANT_NOT_FOUND","Grant not found.","No se encontró la concesión.");try{await pool.query(`INSERT INTO company_policy_authority_revocations(id,grant_id,revoked_by_id,reason_code,explanation_en,explanation_es,audit_evidence) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)`,[crypto.randomUUID(),input.grantId,actor.userId,input.reasonCode,input.explanation.en.trim(),input.explanation.es.trim(),JSON.stringify({source:"verified_super_admin_revocation"})]);}catch{throw new FeaturePolicyError(409,"GRANT_ALREADY_REVOKED","Grant is already revoked.","La concesión ya está revocada.");}return{revoked:true};}

type BindProjectCompanyInput={actorUserId:number;projectId:number;companyId:number;reasonCode:string;explanation:{en:string;es:string};initialCreation?:boolean};
export async function bindProjectCompany(input:BindProjectCompanyInput):Promise<Record<string,unknown>>{
  await waitForFeaturePolicyMigration();
  const actor=await actorFor(input.actorUserId);
  if(!Number.isSafeInteger(input.projectId)||input.projectId<=0||!Number.isSafeInteger(input.companyId)||input.companyId<=0)throw new FeaturePolicyError(400,"PROJECT_BINDING_SCOPE_INVALID","Project and company identifiers must be positive integers.","Los identificadores de proyecto y empresa deben ser enteros positivos.");
  if(!reasonPattern.test(input.reasonCode)||!boundedText(input.explanation.en)||!boundedText(input.explanation.es))throw new FeaturePolicyError(400,"PROJECT_BINDING_EXPLANATION_INVALID","A bounded reason and bilingual explanation are required.","Se requieren un motivo limitado y una explicación bilingüe.");
  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    const fresh=await client.query(`SELECT id,company_id,is_super_admin FROM users WHERE id=$1 FOR SHARE`,[actor.userId]);
    const current=fresh.rows[0];
    if(!current||Number(current.company_id)!==actor.companyId||Boolean(current.is_super_admin)!==actor.isSuperAdmin)throw new FeaturePolicyError(403,"AUTHORITY_CHANGED","Current metadata authority changed.","La autoridad actual de metadatos cambió.");
    const project=await client.query(`SELECT id,created_by_id FROM projects WHERE id=$1 FOR SHARE`,[input.projectId]);
    if(!project.rows[0])throw new FeaturePolicyError(404,"PROJECT_NOT_FOUND","Project not found.","No se encontró el proyecto.");
    const company=await client.query(`SELECT 1 FROM companies WHERE id=$1`,[input.companyId]);
    if(!company.rows[0])throw new FeaturePolicyError(404,"COMPANY_NOT_FOUND","Company not found.","No se encontró la empresa.");
    const initialAllowed=input.initialCreation===true&&Number(project.rows[0].created_by_id)===actor.userId&&actor.companyId===input.companyId;
    if(!actor.isSuperAdmin&&!initialAllowed)throw new FeaturePolicyError(403,"PROJECT_BINDING_METADATA_AUTHORITY_REQUIRED","Verified super-admin metadata authority is required to bind or rebind a project.","Se requiere autoridad verificada de metadatos de superadministrador para vincular o revincular un proyecto.");
    if(!actor.isSuperAdmin&&actor.companyId!==input.companyId)throw new FeaturePolicyError(403,"CROSS_COMPANY_FORBIDDEN","Cross-company users cannot bind projects.","Los usuarios de otra empresa no pueden vincular proyectos.");
    await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`,[`project-company:${input.projectId}`]);
    const prior=await client.query(`SELECT id,version,company_id FROM project_company_binding_versions WHERE project_id=$1 ORDER BY version DESC LIMIT 1`,[input.projectId]);
    if(input.initialCreation&&prior.rows[0])throw new FeaturePolicyError(409,"PROJECT_ALREADY_BOUND","The new project already has a company binding.","El proyecto nuevo ya tiene una vinculación de empresa.");
    const version=Number(prior.rows[0]?.version??0)+1;
    const id=crypto.randomUUID();
    await client.query(`INSERT INTO project_company_binding_versions(id,project_id,company_id,version,bound_by_id,reason_code,explanation_en,explanation_es,supersedes_binding_id,audit_evidence) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,[id,input.projectId,input.companyId,version,actor.userId,input.reasonCode,input.explanation.en.trim(),input.explanation.es.trim(),prior.rows[0]?.id??null,JSON.stringify({source:input.initialCreation?"authenticated_project_creation":"audited_metadata_binding"})]);
    await client.query("COMMIT");
    return{projectId:input.projectId,companyId:input.companyId,version,bindingId:id,metadataOnly:true,rebind:version>1};
  }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
}

export async function listProjectCompanyBindingMetadata(actorUserId:number,projectId:number):Promise<Record<string,unknown>[]>{
  await waitForFeaturePolicyMigration();const actor=await actorFor(actorUserId);if(!actor.isSuperAdmin)throw new FeaturePolicyError(403,"SUPER_ADMIN_REQUIRED","Verified super-admin metadata authority is required.","Se requiere autoridad verificada de metadatos de superadministrador.");
  const result=await pool.query(`SELECT project_id,company_id,version,reason_code,explanation_en,explanation_es,created_at FROM project_company_binding_versions WHERE project_id=$1 ORDER BY version DESC LIMIT 100`,[projectId]);
  return result.rows.map(row=>({projectId:Number(row.project_id),companyId:Number(row.company_id),version:Number(row.version),reasonCode:String(row.reason_code),explanation:{en:String(row.explanation_en),es:String(row.explanation_es)},timestamp:new Date(row.created_at).toISOString(),metadataOnly:true}));
}

export async function inspectPolicyAudit(input:{userId:number;scope:"company"|"project";projectId?:number;featureKey?:string}):Promise<Record<string,unknown>[]>{await waitForFeaturePolicyMigration();const actor=await actorFor(input.userId);if(input.scope==="company"&&!await hasCompanyGrant(actor))throw new FeaturePolicyError(403,"COMPANY_POLICY_AUTHORITY_REQUIRED","Company policy authority is required.","Se requiere autoridad de política de empresa.");if(input.scope==="project")await projectAuthority(actor,Number(input.projectId),true);const field=input.scope==="company"?"v.company_id":"v.project_id";const value=input.scope==="company"?actor.companyId:Number(input.projectId);const params:unknown[]=[input.scope,value];let filter="";if(input.featureKey){if(!FEATURE_KEY_PATTERN.test(input.featureKey))throw new FeaturePolicyError(400,"FEATURE_KEY_INVALID","Feature key is invalid.","La clave de función no es válida.");params.push(input.featureKey);filter=" AND v.feature_key=$3";}const result=await pool.query(`SELECT v.feature_key,v.scope_type,v.version,v.decision,v.reason_code,v.explanation_en,v.explanation_es,v.effective_from,v.effective_to,v.created_at,a.evidence FROM feature_policy_versions v JOIN feature_policy_audit a ON a.policy_version_id=v.id WHERE v.scope_type=$1 AND ${field}=$2${filter} ORDER BY v.feature_key,v.version DESC LIMIT 200`,params);return result.rows.map(row=>({featureKey:row.feature_key,scopeType:row.scope_type,version:Number(row.version),decision:row.decision,reasonCode:row.reason_code,explanation:{en:row.explanation_en,es:row.explanation_es},effectiveFrom:new Date(row.effective_from).toISOString(),effectiveTo:row.effective_to?new Date(row.effective_to).toISOString():null,createdAt:new Date(row.created_at).toISOString(),authority:"verified_current_scope_admin",evidence:{source:row.evidence?.source??"policy_api"}}));}

export async function policyCapabilities(userId:number):Promise<Record<string,unknown>>{const actor=await actorFor(userId);const companyAdmin=await hasCompanyGrant(actor);const projects=await pool.query(`SELECT p.id,p.name,pm.role,pm.status,co.meta,b.company_id FROM project_members pm JOIN projects p ON p.id=pm.project_id LEFT JOIN LATERAL(SELECT company_id FROM project_company_binding_versions WHERE project_id=p.id ORDER BY version DESC LIMIT 1)b ON true LEFT JOIN config_options co ON co.category='member_role' AND co.value=pm.role WHERE pm.user_id=$1 AND (b.company_id=$2 OR b.company_id IS NULL) ORDER BY p.name LIMIT 100`,[actor.userId,actor.companyId]);return{companyPolicyAdmin:companyAdmin,superAdminMetadataOnly:actor.isSuperAdmin&&!companyAdmin,projects:projects.rows.map(row=>{const meta=plainObject(row.meta)?row.meta:null;const permission=typeof meta?.permission==="string"?meta.permission:null;const mapping=mapCurrentProjectRole(row.role,permission);return{id:Number(row.id),name:String(row.name),active:row.status==="active",bindingRequired:row.company_id==null,canConfigure:row.company_id!=null&&row.status==="active"&&mapping.knownRole&&hasScopedAuthority(mapping,["project:admin"])};})};}
