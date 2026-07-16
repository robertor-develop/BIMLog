import { hasScopedAuthority, mapCurrentProjectRole } from "./scoped-authority";

export type CapabilityStatus = "available" | "preview" | "coming_later" | "suspended" | "deprecated";
export type AiClassification = "non_ai" | "deterministic_automation" | "text_ai" | "file_reading_ai" | "proactive_ai";
export type EntitlementCode =
  | "ENT_AVAILABLE" | "ENT_UNAVAILABLE" | "ENT_COMING_LATER" | "ENT_PREVIEW_ONLY"
  | "ENT_TRIAL_ACTIVE" | "ENT_INCLUDED" | "ENT_ADDON_REQUIRED" | "ENT_ALLOWANCE_EXHAUSTED"
  | "ENT_COMPANY_DISABLED" | "ENT_PROJECT_DISABLED" | "ENT_ROLE_RESTRICTED" | "ENT_USER_DISABLED"
  | "ENT_CONFIRMATION_REQUIRED" | "ENT_TEMP_SUSPENDED" | "ENT_DEPRECATED"
  | "ENT_COMMERCIAL_AUTHORITY_NOT_CONFIGURED";

export interface BilingualText { en: string; es: string }
export interface EntitlementSource { authority: string; id: string; version: number }
export interface EntitlementDecision {
  decision: "allow" | "deny" | "confirm" | "preview";
  state: string;
  code: EntitlementCode;
  featureKey: string;
  explanation: BilingualText;
  sources: EntitlementSource[];
  allowance?: { unit: string; remaining: string; requested: string };
  confirmations?: string[];
  evaluatedAt: string;
  evaluation: { mode: "advisory_read_only"; authorizesExecution: false };
}

export interface CatalogFeature {
  id: string;
  featureKey: string;
  version: number;
  name: BilingualText;
  description: BilingualText;
  productFamily: string;
  module: string;
  capabilityStatus: CapabilityStatus;
  tierAvailability: string[];
  bundleDependencies: string[];
  eligibleSeatClasses: string[];
  requiredScopedAuthorities: string[];
  supportsCompanyPolicy: boolean;
  supportsProjectPolicy: boolean;
  aiClassification: AiClassification;
  supportedCreditPayers: string[];
  meteringPolicyKey: string | null;
  confirmationRequirements: string[];
  fileReading: boolean;
  externalDelivery: boolean;
  auditRequirements: string[];
  authorizedDataScope: string[];
  previewUpgradeExplanation: BilingualText;
  effectiveFrom: string;
  effectiveTo: string | null;
  deprecatedAt: string | null;
  replacementFeatureKey: string | null;
  deprecationExplanation: BilingualText | null;
  contractOverrideMode: "none" | "restrict_only" | "grant_and_restrict";
  capabilityDependencies: string[];
  commercialAuthority: "none" | "tier" | "addon" | "tier_or_addon";
  preferenceKey: string | null;
}

export interface ResolverContext {
  now?: Date;
  platform?: { status: CapabilityStatus; version: number; explanation?: BilingualText };
  dependencies?: { featureKey: string; status: CapabilityStatus; version: number }[];
  project?: { requested: boolean; membership: "active" | "inactive" | "missing"; role?: string; permissionCategory?: string | null };
  commercial?: {
    configured: boolean;
    tierIncluded?: boolean;
    addonIncluded?: boolean;
    trialActive?: boolean;
    contractDecision?: "grant" | "restrict";
  };
  companyPolicy?: { enabled: boolean; version: number };
  projectPolicy?: { enabled: boolean; version: number };
  seat?: { configured: boolean; eligible: boolean; className?: string };
  userPreference?: { enabled: boolean; version: number };
  allowance?: { allowed: boolean; unit: string; remaining: string; requested: string; version: number };
  aiControl?: { allowed: boolean; code?: EntitlementCode; state?: string; version: number; allowance?: { unit: string; remaining: string; requested: string } };
  trustedConfirmations?: string[];
}

export const FEATURE_KEY_PATTERN = /^[a-z][a-z0-9_.-]{2,119}$/;
export const CONFIRMATION_ID_PATTERN = /^[a-z][a-z0-9_.:-]{2,79}$/;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const bounded = (value: string, maximum: number): boolean => value.length > 0 && value.length <= maximum && !CONTROL_CHARACTERS.test(value);
const boundedArray = (values: readonly string[], maximumItems = 32): boolean => values.length <= maximumItems && values.every((value) => bounded(value, 120));

export function validateCatalogFeature(feature: CatalogFeature): boolean {
  const optional = (value: string | null, maximum: number): boolean => value === null || bounded(value, maximum);
  return bounded(feature.id, 160) && FEATURE_KEY_PATTERN.test(feature.featureKey)
    && bounded(feature.name.en, 120) && bounded(feature.name.es, 120)
    && bounded(feature.description.en, 1000) && bounded(feature.description.es, 1000)
    && bounded(feature.productFamily, 80) && bounded(feature.module, 80)
    && bounded(feature.previewUpgradeExplanation.en, 1000) && bounded(feature.previewUpgradeExplanation.es, 1000)
    && optional(feature.meteringPolicyKey, 120) && optional(feature.preferenceKey, 120) && optional(feature.replacementFeatureKey, 120)
    && (feature.deprecationExplanation === null || (bounded(feature.deprecationExplanation.en, 1000) && bounded(feature.deprecationExplanation.es, 1000)))
    && !Number.isNaN(Date.parse(feature.effectiveFrom)) && (feature.effectiveTo === null || !Number.isNaN(Date.parse(feature.effectiveTo)))
    && [feature.tierAvailability, feature.bundleDependencies, feature.eligibleSeatClasses, feature.requiredScopedAuthorities,
      feature.supportedCreditPayers, feature.confirmationRequirements, feature.auditRequirements, feature.authorizedDataScope,
      feature.capabilityDependencies].every((values) => boundedArray(values));
}

export const ENTITLEMENT_EXPLANATIONS: Record<EntitlementCode, BilingualText> = {
  ENT_AVAILABLE: { en: "This capability is available for this request.", es: "Esta capacidad está disponible para esta solicitud." },
  ENT_UNAVAILABLE: { en: "This capability is not available for this request.", es: "Esta capacidad no está disponible para esta solicitud." },
  ENT_COMING_LATER: { en: "This capability is planned for a later release and cannot run now.", es: "Esta capacidad está prevista para una versión futura y no se puede ejecutar ahora." },
  ENT_PREVIEW_ONLY: { en: "This capability is a preview only and cannot run.", es: "Esta capacidad es solo una vista previa y no se puede ejecutar." },
  ENT_TRIAL_ACTIVE: { en: "This capability is available through an active evaluation grant.", es: "Esta capacidad está disponible mediante una evaluación activa." },
  ENT_INCLUDED: { en: "This capability is included by a configured commercial authority.", es: "Esta capacidad está incluida por una autoridad comercial configurada." },
  ENT_ADDON_REQUIRED: { en: "This capability requires an eligible add-on or bundle.", es: "Esta capacidad requiere un complemento o paquete elegible." },
  ENT_ALLOWANCE_EXHAUSTED: { en: "The configured allowance is insufficient for this request.", es: "La asignación configurada no es suficiente para esta solicitud." },
  ENT_COMPANY_DISABLED: { en: "Your company has disabled this capability.", es: "Su empresa ha desactivado esta capacidad." },
  ENT_PROJECT_DISABLED: { en: "This project has disabled this capability.", es: "Este proyecto ha desactivado esta capacidad." },
  ENT_ROLE_RESTRICTED: { en: "Your active project role does not authorize this capability.", es: "Su rol activo en el proyecto no autoriza esta capacidad." },
  ENT_USER_DISABLED: { en: "You have opted out of this capability.", es: "Usted ha desactivado esta capacidad." },
  ENT_CONFIRMATION_REQUIRED: { en: "Exact confirmation is required before this capability can run.", es: "Se requiere una confirmación exacta antes de ejecutar esta capacidad." },
  ENT_TEMP_SUSPENDED: { en: "This capability is temporarily suspended at platform level.", es: "Esta capacidad está suspendida temporalmente a nivel de plataforma." },
  ENT_DEPRECATED: { en: "This capability is deprecated and cannot be used for new actions.", es: "Esta capacidad está obsoleta y no se puede usar para acciones nuevas." },
  ENT_COMMERCIAL_AUTHORITY_NOT_CONFIGURED: { en: "The required commercial authority is not configured yet.", es: "La autoridad comercial requerida aún no está configurada." },
};

const source = (authority: string, id: string, version: number): EntitlementSource => ({ authority, id, version });

export function resolveEntitlement(feature: CatalogFeature, context: ResolverContext = {}): EntitlementDecision {
  const evaluatedAt = (context.now ?? new Date()).toISOString();
  const sources: EntitlementSource[] = [source("feature_catalog", `catalog:${feature.featureKey}`, feature.version)];
  const finish = (decision: EntitlementDecision["decision"], state: string, code: EntitlementCode, explanation = ENTITLEMENT_EXPLANATIONS[code], extra: Partial<EntitlementDecision> = {}): EntitlementDecision => ({
    decision, state, code, featureKey: feature.featureKey, explanation, sources: [...sources], evaluatedAt,
    evaluation: { mode: "advisory_read_only", authorizesExecution: false }, ...extra,
  });

  const platform = context.platform ?? { status: feature.capabilityStatus, version: feature.version };
  sources.push(source("platform_capability", `platform:${feature.featureKey}`, platform.version));
  if (platform.status === "coming_later") return finish("deny", "platform_coming_later", "ENT_COMING_LATER", platform.explanation);
  if (platform.status === "preview") return finish("preview", "platform_preview_only", "ENT_PREVIEW_ONLY", platform.explanation ?? feature.previewUpgradeExplanation);
  if (platform.status === "suspended") return finish("deny", "platform_suspended", "ENT_TEMP_SUSPENDED", platform.explanation);
  if (platform.status === "deprecated") return finish("deny", "platform_deprecated", "ENT_DEPRECATED", feature.deprecationExplanation ?? platform.explanation);
  for (const dependency of context.dependencies ?? []) {
    sources.push(source("capability_dependency", `dependency:${dependency.featureKey}`, dependency.version));
    if (dependency.status === "coming_later") return finish("deny", "dependency_coming_later", "ENT_COMING_LATER");
    if (dependency.status === "preview") return finish("preview", "dependency_preview_only", "ENT_PREVIEW_ONLY");
    if (dependency.status === "suspended") return finish("deny", "dependency_suspended", "ENT_TEMP_SUSPENDED");
    if (dependency.status === "deprecated") return finish("deny", "dependency_deprecated", "ENT_DEPRECATED");
  }

  let commercialCode: EntitlementCode = "ENT_AVAILABLE";
  if (feature.commercialAuthority !== "none") {
    const commercial = context.commercial;
    if (!commercial?.configured) return finish("deny", "commercial_authority_not_configured", "ENT_COMMERCIAL_AUTHORITY_NOT_CONFIGURED");
    sources.push(source("subscription_tier", "commercial:tier", 1));
    let granted = commercial.tierIncluded === true;
    if (commercial.addonIncluded) { sources.push(source("purchased_addon", "commercial:addon", 1)); granted = true; }
    if (commercial.trialActive) { sources.push(source("trial_grant", "commercial:trial", 1)); granted = true; commercialCode = "ENT_TRIAL_ACTIVE"; }
    if (commercial.contractDecision) {
      sources.push(source("contract_override", "commercial:contract", 1));
      if (commercial.contractDecision === "restrict") granted = false;
      if (commercial.contractDecision === "grant" && feature.contractOverrideMode === "grant_and_restrict") granted = true;
    }
    if (!granted) return finish("deny", "addon_or_tier_required", "ENT_ADDON_REQUIRED");
    if (commercialCode !== "ENT_TRIAL_ACTIVE") commercialCode = "ENT_INCLUDED";
  }

  if (feature.supportsCompanyPolicy && context.companyPolicy) {
    sources.push(source("company_policy", "policy:company", context.companyPolicy.version));
    if (!context.companyPolicy.enabled) return finish("deny", "company_policy_disabled", "ENT_COMPANY_DISABLED");
  }
  if (feature.supportsProjectPolicy && context.projectPolicy) {
    sources.push(source("project_policy", "policy:project", context.projectPolicy.version));
    if (!context.projectPolicy.enabled) return finish("deny", "project_policy_disabled", "ENT_PROJECT_DISABLED");
  }
  if (context.seat?.configured) {
    sources.push(source("seat_eligibility", "seat:current", 1));
    if (!context.seat.eligible) return finish("deny", "seat_ineligible", "ENT_ROLE_RESTRICTED");
  }
  if (context.project?.requested) {
    sources.push(source("project_membership", `membership:${context.project.membership}`, 1));
    if (context.project.membership !== "active") return finish("deny", `project_membership_${context.project.membership}`, "ENT_ROLE_RESTRICTED");
    const mapping = mapCurrentProjectRole(context.project.role, context.project.permissionCategory);
    if (!mapping.knownRole || (feature.requiredScopedAuthorities.length > 0 && !hasScopedAuthority(mapping, feature.requiredScopedAuthorities))) {
      return finish("deny", "scoped_role_restricted", "ENT_ROLE_RESTRICTED");
    }
  }
  if (feature.preferenceKey && context.userPreference) {
    sources.push(source("user_preference", `preference:${feature.preferenceKey}`, context.userPreference.version));
    if (!context.userPreference.enabled) return finish("deny", "user_opted_out", "ENT_USER_DISABLED");
  }
  if (context.aiControl) {
    sources.push(source("ai_control_plane", "ai-control:effective", context.aiControl.version));
    if (!context.aiControl.allowed) return finish("deny", context.aiControl.state ?? "ai_control_denied", context.aiControl.code ?? "ENT_ALLOWANCE_EXHAUSTED", undefined, { allowance: context.aiControl.allowance });
  }
  if (context.allowance) {
    sources.push(source("allowance", "allowance:effective", context.allowance.version));
    if (!context.allowance.allowed) return finish("deny", "allowance_exhausted", "ENT_ALLOWANCE_EXHAUSTED", undefined, { allowance: context.allowance });
  }

  const required = [...new Set([
    ...feature.confirmationRequirements,
    ...(feature.fileReading ? ["confirm_files_and_scope"] : []),
    ...(feature.externalDelivery ? ["confirm_exact_recipients"] : []),
  ])];
  const trusted = context.trustedConfirmations ?? [];
  if (trusted.length > 20 || trusted.some((item) => !CONFIRMATION_ID_PATTERN.test(item))) {
    return finish("deny", "invalid_trusted_confirmation_context", "ENT_UNAVAILABLE");
  }
  const confirmed = new Set(trusted);
  const missing = required.filter((item) => !confirmed.has(item));
  if (missing.length) return finish("confirm", "exact_confirmation_required", "ENT_CONFIRMATION_REQUIRED", undefined, { confirmations: missing });
  return finish("allow", commercialCode === "ENT_TRIAL_ACTIVE" ? "trial_active" : "available", commercialCode);
}
