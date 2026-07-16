import crypto from "crypto";
import { pool } from "@workspace/db";
import { ENTITLEMENT_EXPLANATIONS, FEATURE_KEY_PATTERN, resolveEntitlement, validateCatalogFeature, type BilingualText, type CapabilityStatus, type CatalogFeature, type EntitlementDecision, type ResolverContext } from "./entitlement-contract";
import { waitForFeatureCatalogMigration } from "./feature-catalog-migration";

export class FeatureCatalogError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) { super(message); }
}

const array = (value: unknown): string[] => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw new FeatureCatalogError(503, "CATALOG_INVALID", "Feature catalog data is unavailable.");
  return value;
};
const iso = (value: unknown): string => value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
const maybeIso = (value: unknown): string | null => value == null ? null : iso(value);

function mapFeature(row: Record<string, unknown>): CatalogFeature {
  const deprecation = row.deprecation_explanation_en && row.deprecation_explanation_es
    ? { en: String(row.deprecation_explanation_en), es: String(row.deprecation_explanation_es) } : null;
  const feature: CatalogFeature = {
    id: String(row.id), featureKey: String(row.feature_key), version: Number(row.version),
    name: { en: String(row.name_en), es: String(row.name_es) },
    description: { en: String(row.description_en), es: String(row.description_es) },
    productFamily: String(row.product_family), module: String(row.module), capabilityStatus: String(row.capability_status) as CatalogFeature["capabilityStatus"],
    tierAvailability: array(row.tier_availability), bundleDependencies: array(row.bundle_dependencies), eligibleSeatClasses: array(row.eligible_seat_classes),
    requiredScopedAuthorities: array(row.required_scoped_authorities), supportsCompanyPolicy: row.supports_company_policy === true,
    supportsProjectPolicy: row.supports_project_policy === true, aiClassification: String(row.ai_classification) as CatalogFeature["aiClassification"],
    supportedCreditPayers: array(row.supported_credit_payers), meteringPolicyKey: row.metering_policy_key == null ? null : String(row.metering_policy_key),
    confirmationRequirements: array(row.confirmation_requirements), fileReading: row.file_reading === true, externalDelivery: row.external_delivery === true,
    auditRequirements: array(row.audit_requirements), authorizedDataScope: array(row.authorized_data_scope),
    previewUpgradeExplanation: { en: String(row.preview_upgrade_explanation_en), es: String(row.preview_upgrade_explanation_es) },
    effectiveFrom: iso(row.effective_from), effectiveTo: maybeIso(row.effective_to), deprecatedAt: maybeIso(row.deprecated_at), replacementFeatureKey: row.replacement_feature_key == null ? null : String(row.replacement_feature_key),
    deprecationExplanation: deprecation, contractOverrideMode: String(row.contract_override_mode) as CatalogFeature["contractOverrideMode"],
    capabilityDependencies: array(row.capability_dependencies), commercialAuthority: String(row.commercial_authority) as CatalogFeature["commercialAuthority"],
    preferenceKey: row.preference_key == null ? null : String(row.preference_key),
  };
  if (!validateCatalogFeature(feature)) throw new FeatureCatalogError(503, "CATALOG_INVALID", "Feature catalog data is unavailable.");
  return feature;
}

const EFFECTIVE_CATALOG_SQL = `
  SELECT DISTINCT ON(v.feature_key) v.*
  FROM feature_catalog_versions v JOIN feature_catalog_activations a ON a.catalog_version_id=v.id
  WHERE v.effective_from<=$1 AND (v.effective_to IS NULL OR v.effective_to>$1)
  ORDER BY v.feature_key,v.version DESC,a.activated_at DESC`;

export async function listEffectiveCatalog(at = new Date()): Promise<CatalogFeature[]> {
  await waitForFeatureCatalogMigration();
  const result = await pool.query(EFFECTIVE_CATALOG_SQL, [at]);
  return result.rows.map((row) => mapFeature(row));
}

export async function getEffectiveFeature(featureKey: string, at = new Date()): Promise<CatalogFeature | null> {
  await waitForFeatureCatalogMigration();
  if (!FEATURE_KEY_PATTERN.test(featureKey)) throw new FeatureCatalogError(400, "FEATURE_KEY_INVALID", "Feature key is invalid.");
  const result = await pool.query(`${EFFECTIVE_CATALOG_SQL.replace("ORDER BY", "AND v.feature_key=$2 ORDER BY")}`, [at, featureKey]);
  return result.rows[0] ? mapFeature(result.rows[0]) : null;
}

export async function listCatalogVersions(): Promise<Record<string, unknown>[]> {
  await waitForFeatureCatalogMigration();
  const result = await pool.query(`SELECT v.id,v.feature_key,v.version,v.capability_status,v.ai_classification,v.effective_from,v.effective_to,
    a.activated_at,a.activated_by_id IS NOT NULL AS activated_by_user
    FROM feature_catalog_versions v LEFT JOIN feature_catalog_activations a ON a.catalog_version_id=v.id
    ORDER BY v.feature_key,v.version DESC`);
  return result.rows.map((row) => ({
    id: row.id, featureKey: row.feature_key, version: row.version, capabilityStatus: row.capability_status,
    aiClassification: row.ai_classification, effectiveFrom: iso(row.effective_from), effectiveTo: maybeIso(row.effective_to),
    activatedAt: maybeIso(row.activated_at), activationAuthority: row.activated_by_user ? "verified_super_admin" : "verified_system_seed",
  }));
}

async function platformContext(featureKey: string, at: Date): Promise<ResolverContext["platform"]> {
  const result = await pool.query(`SELECT version,capability_status,explanation_en,explanation_es FROM platform_capability_versions
    WHERE feature_key=$1 AND effective_from<=$2 AND (effective_to IS NULL OR effective_to>$2) ORDER BY version DESC LIMIT 1`, [featureKey, at]);
  const row = result.rows[0];
  return row ? { status: row.capability_status as CapabilityStatus, version: Number(row.version), explanation: { en: row.explanation_en, es: row.explanation_es } } : undefined;
}

async function aiControlContext(feature: CatalogFeature, companyId: number): Promise<ResolverContext["aiControl"]> {
  if (!feature.meteringPolicyKey?.startsWith("ai_control_plane:")) return undefined;
  const capability = feature.meteringPolicyKey.slice("ai_control_plane:".length);
  const result = await pool.query(`SELECT version FROM entitlement_rules WHERE capability=$1 AND enabled=true
    AND (company_id=$2 OR company_id IS NULL) AND effective_from<=now() AND (effective_to IS NULL OR effective_to>now())
    ORDER BY CASE WHEN company_id=$2 THEN 0 ELSE 1 END,version DESC LIMIT 1`, [capability, companyId]);
  if (!result.rows[0]) return { allowed: false, state: "ai_control_authority_not_configured", code: "ENT_COMMERCIAL_AUTHORITY_NOT_CONFIGURED", version: 0 };
  return { allowed: true, version: Number(result.rows[0].version) };
}

const advisoryDenial = (featureKey: string, state: string, now: Date): EntitlementDecision => ({
  decision: "deny", state, code: "ENT_UNAVAILABLE", featureKey, explanation: ENTITLEMENT_EXPLANATIONS.ENT_UNAVAILABLE,
  sources: [{ authority: "authenticated_user", id: "user:current", version: 1 }], evaluatedAt: now.toISOString(),
  evaluation: { mode: "advisory_read_only", authorizesExecution: false },
});

export async function resolveEffectiveEntitlement(input: { featureKey: string; userId: number; companyId: number; projectId?: number }): Promise<EntitlementDecision> {
  const now = new Date();
  if (!FEATURE_KEY_PATTERN.test(input.featureKey)) throw new FeatureCatalogError(400, "FEATURE_KEY_INVALID", "Feature key is invalid.");
  const currentUser = await pool.query(`SELECT company_id FROM users WHERE id=$1 LIMIT 1`, [input.userId]);
  const currentCompanyId = Number(currentUser.rows[0]?.company_id);
  if (!Number.isSafeInteger(currentCompanyId) || currentCompanyId !== input.companyId) return advisoryDenial(input.featureKey, "authenticated_company_changed", now);
  const feature = await getEffectiveFeature(input.featureKey, now);
  if (!feature) return { decision: "deny", state: "feature_not_found", code: "ENT_UNAVAILABLE", featureKey: input.featureKey,
    explanation: ENTITLEMENT_EXPLANATIONS.ENT_UNAVAILABLE, sources: [], evaluatedAt: now.toISOString(), evaluation: { mode: "advisory_read_only", authorizesExecution: false } };
  const context: ResolverContext = { now, platform: await platformContext(feature.featureKey, now) };
  context.dependencies = [];
  for (const dependencyKey of feature.capabilityDependencies) {
    const dependency = await getEffectiveFeature(dependencyKey, now);
    if (!dependency) {
      context.dependencies.push({ featureKey: dependencyKey, status: "suspended", version: 0 });
      continue;
    }
    const override = await platformContext(dependencyKey, now);
    context.dependencies.push({ featureKey: dependencyKey, status: override?.status ?? dependency.capabilityStatus, version: override?.version ?? dependency.version });
  }
  if (feature.commercialAuthority !== "none") context.commercial = { configured: false };
  if (input.projectId !== undefined) {
    const membership = await pool.query(`SELECT pm.role,pm.status,co.meta FROM project_members pm
      LEFT JOIN config_options co ON co.category='member_role' AND co.value=pm.role
      WHERE pm.project_id=$1 AND pm.user_id=$2 ORDER BY co.id NULLS LAST LIMIT 1`, [input.projectId, input.userId]);
    const row = membership.rows[0];
    const meta = row?.meta && typeof row.meta === "object" ? row.meta as Record<string, unknown> : null;
    const legacyPermission = row?.role === "admin" ? "admin" : row?.role === "viewer" ? "read" : null;
    context.project = { requested: true, membership: !row ? "missing" : row.status === "active" ? "active" : "inactive", role: row?.role, permissionCategory: typeof meta?.permission === "string" ? meta.permission : legacyPermission };
  }
  if (feature.preferenceKey) {
    const preference = await pool.query(`SELECT notification_preferences FROM users WHERE id=$1`, [input.userId]);
    const values = preference.rows[0]?.notification_preferences;
    if (values && typeof values === "object" && feature.preferenceKey in values) {
      context.userPreference = { enabled: values[feature.preferenceKey] !== false, version: 1 };
    }
  }
  context.aiControl = await aiControlContext(feature, currentCompanyId);
  return resolveEntitlement(feature, context);
}

export async function createPlatformCapabilityVersion(input: { featureKey: string; status: CapabilityStatus; reasonCode: string; explanation: BilingualText; actorUserId: number }): Promise<Record<string, unknown>> {
  await waitForFeatureCatalogMigration();
  if (!FEATURE_KEY_PATTERN.test(input.featureKey)) throw new FeatureCatalogError(400, "FEATURE_KEY_INVALID", "Feature key is invalid.");
  if (!/^[A-Z][A-Z0-9_]{2,79}$/.test(input.reasonCode)) throw new FeatureCatalogError(400, "REASON_CODE_INVALID", "Reason code is invalid.");
  if (![input.explanation.en,input.explanation.es].every((value) => value.length > 0 && value.length <= 1000 && !/[\u0000-\u001f\u007f]/.test(value))) {
    throw new FeatureCatalogError(400, "EXPLANATION_INVALID", "English and Spanish explanations must be bounded plain text.");
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const authority = await client.query(`SELECT is_super_admin FROM users WHERE id=$1 FOR SHARE`, [input.actorUserId]);
    if (authority.rows[0]?.is_super_admin !== true) throw new FeatureCatalogError(403, "SUPER_ADMIN_REQUIRED", "Verified super-admin authority is required.");
    const catalog = await client.query(`SELECT 1 FROM feature_catalog_versions WHERE feature_key=$1 LIMIT 1`, [input.featureKey]);
    if (!catalog.rows[0]) throw new FeatureCatalogError(404, "FEATURE_NOT_FOUND", "Feature not found.");
    await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [input.featureKey]);
    const next = await client.query(`SELECT COALESCE(MAX(version),0)+1 AS version FROM platform_capability_versions WHERE feature_key=$1`, [input.featureKey]);
    const version = Number(next.rows[0].version);
    const id = crypto.randomUUID();
    const result = await client.query(`INSERT INTO platform_capability_versions(id,feature_key,version,capability_status,reason_code,explanation_en,explanation_es,effective_from,created_by_id,audit_evidence)
      VALUES($1,$2,$3,$4,$5,$6,$7,now(),$8,$9::jsonb) RETURNING feature_key,version,capability_status,reason_code,effective_from`,
      [id,input.featureKey,version,input.status,input.reasonCode,input.explanation.en,input.explanation.es,input.actorUserId,JSON.stringify({ source: "super_admin_api" })]);
    await client.query("COMMIT");
    const row = result.rows[0];
    return { featureKey: row.feature_key, version: row.version, capabilityStatus: row.capability_status, reasonCode: row.reason_code, effectiveFrom: iso(row.effective_from) };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
