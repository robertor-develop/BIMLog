import type { AiClassification, CapabilityStatus, CatalogFeature } from "./entitlement-contract";

type SeedInput = {
  key: string;
  nameEn: string;
  nameEs: string;
  descriptionEn: string;
  descriptionEs: string;
  family: string;
  module: string;
  status?: CapabilityStatus;
  ai?: AiClassification;
  authorities?: string[];
  tiers?: string[];
  bundles?: string[];
  dependencies?: string[];
  payers?: string[];
  meter?: string | null;
  confirmations?: string[];
  fileReading?: boolean;
  externalDelivery?: boolean;
  companyPolicy?: boolean;
  projectPolicy?: boolean;
  userPreference?: boolean;
  configurationKeys?: string[];
  commercial?: CatalogFeature["commercialAuthority"];
  contract?: CatalogFeature["contractOverrideMode"];
  preference?: string | null;
  replacement?: string | null;
  deprecation?: { en: string; es: string } | null;
};

const EFFECTIVE_FROM = "2026-07-16T00:00:00.000Z";
const ALL_TIERS = ["explore", "essential", "professional", "business", "enterprise"];
const PROJECT_READ = ["project:read"];
const preview = { en: "This entry does not grant execution. Availability requires a later verified catalog version.", es: "Esta entrada no autoriza la ejecución. La disponibilidad requiere una versión posterior verificada del catálogo." };

function feature(input: SeedInput): CatalogFeature {
  return {
    id: `${input.key}:2`, featureKey: input.key, version: 2,
    name: { en: input.nameEn, es: input.nameEs },
    description: { en: input.descriptionEn, es: input.descriptionEs },
    productFamily: input.family, module: input.module, capabilityStatus: input.status ?? "available",
    tierAvailability: input.tiers ?? ALL_TIERS, bundleDependencies: input.bundles ?? [],
    eligibleSeatClasses: ["viewer", "external_participant", "contributor", "professional", "project_administrator", "company_administrator"],
    requiredScopedAuthorities: input.authorities ?? PROJECT_READ,
    supportsCompanyPolicy: input.companyPolicy ?? false, supportsProjectPolicy: input.projectPolicy ?? false,
    supportsUserPreference: input.userPreference ?? false, policyConfigurationKeys: input.configurationKeys ?? [],
    aiClassification: input.ai ?? "non_ai", supportedCreditPayers: input.payers ?? [], meteringPolicyKey: input.meter ?? null,
    confirmationRequirements: input.confirmations ?? [], fileReading: input.fileReading ?? false, externalDelivery: input.externalDelivery ?? false,
    auditRequirements: ["decision", "actor", "feature_version", "authority_sources"], authorizedDataScope: ["authenticated_user", "active_project_membership"],
    previewUpgradeExplanation: preview, effectiveFrom: EFFECTIVE_FROM, effectiveTo: null, deprecatedAt: null,
    replacementFeatureKey: input.replacement ?? null, deprecationExplanation: input.deprecation ?? null,
    contractOverrideMode: input.contract ?? "restrict_only", capabilityDependencies: input.dependencies ?? [],
    commercialAuthority: input.commercial ?? "none", preferenceKey: input.preference === undefined ? input.key : input.preference,
  };
}

export const INITIAL_FEATURE_CATALOG: readonly CatalogFeature[] = [
  feature({ key: "rfi.core", nameEn: "RFI Core", nameEs: "RFI principal", descriptionEn: "Verified RFI creation, lifecycle, responses, evidence, and audit history.", descriptionEs: "Creación, ciclo de vida, respuestas, evidencia e historial de auditoría de RFI verificados.", family: "project_coordination", module: "rfi", companyPolicy: true, projectPolicy: true }),
  feature({ key: "rfi.export.pdf", nameEn: "RFI PDF exports", nameEs: "Exportaciones PDF de RFI", descriptionEn: "Verified standard, complete, and audit PDF export paths.", descriptionEs: "Rutas verificadas de exportación PDF estándar, completa y de auditoría.", family: "project_coordination", module: "rfi_exports", dependencies: ["rfi.core"], companyPolicy: true, projectPolicy: true, userPreference: true, configurationKeys: ["include_audit_metadata"] }),
  feature({ key: "rfi.export.excel", nameEn: "RFI register Excel export", nameEs: "Exportación Excel del registro RFI", descriptionEn: "Verified native RFI register workbook export.", descriptionEs: "Exportación verificada del libro nativo del registro RFI.", family: "project_coordination", module: "rfi_exports", dependencies: ["rfi.core"], companyPolicy: true, projectPolicy: true, userPreference: true, configurationKeys: ["include_closed_items"] }),
  feature({ key: "rfi.ai.email_draft", nameEn: "RFI AI email draft", nameEs: "Borrador de correo RFI con IA", descriptionEn: "Verified click-driven AI drafting for RFI cover email text; sending remains a separate action.", descriptionEs: "Redacción verificada y activada por clic del texto del correo de RFI con IA; el envío sigue siendo una acción separada.", family: "project_coordination", module: "rfi_ai", ai: "text_ai", meter: "legacy_ai_usage", payers: ["personal"], confirmations: ["confirm_ai_action"], dependencies: ["rfi.core"], authorities: ["project:write"], companyPolicy: true, projectPolicy: true, userPreference: true }),
  feature({ key: "rfi.ai.presubmission_check", nameEn: "RFI AI pre-submission check", nameEs: "Revisión previa al envío de RFI con IA", descriptionEn: "Coming later. The legacy enabled flag is unconsumed and is not evidence of an operational capability.", descriptionEs: "Disponible más adelante. La marca heredada habilitada no se consume y no demuestra una capacidad operativa.", family: "project_coordination", module: "rfi_ai", status: "coming_later", ai: "text_ai", meter: "legacy_ai_usage", dependencies: ["rfi.core"], authorities: ["project:write"] }),
  feature({ key: "rfi.ai.name_suggestion", nameEn: "RFI AI name suggestion", nameEs: "Sugerencia de nombre de RFI con IA", descriptionEn: "Coming later. The legacy enabled flag is unconsumed and is not evidence of an operational capability.", descriptionEs: "Disponible más adelante. La marca heredada habilitada no se consume y no demuestra una capacidad operativa.", family: "project_coordination", module: "rfi_ai", status: "coming_later", ai: "text_ai", meter: "legacy_ai_usage", dependencies: ["rfi.core"], authorities: ["project:write"] }),
  feature({ key: "telegram.linking", nameEn: "Telegram account linking", nameEs: "Vinculación de cuenta de Telegram", descriptionEn: "Verified consent-based Telegram channel linking and revocation.", descriptionEs: "Vinculación y revocación verificadas del canal de Telegram basadas en consentimiento.", family: "communications", module: "telegram" }),
  feature({ key: "telegram.assistant", nameEn: "Telegram Assistant", nameEs: "Asistente de Telegram", descriptionEn: "Verified click-driven bilingual assistant using the existing AI control plane.", descriptionEs: "Asistente bilingüe verificado y activado por clic que usa el plano de control de IA existente.", family: "communications", module: "telegram", ai: "text_ai", payers: ["personal", "company", "system"], meter: "ai_control_plane:assistant", confirmations: ["confirm_ai_estimate"], dependencies: ["telegram.linking"], companyPolicy: true, projectPolicy: true, userPreference: true }),
  feature({ key: "telegram.support", nameEn: "Telegram Support", nameEs: "Soporte por Telegram", descriptionEn: "Verified support-case creation and authorized review workflow.", descriptionEs: "Creación verificada de casos de soporte y flujo de revisión autorizado.", family: "communications", module: "telegram", dependencies: ["telegram.linking"] }),
  feature({ key: "telegram.delivery_concierge", nameEn: "Telegram Delivery Concierge", nameEs: "Concierge de entrega por Telegram", descriptionEn: "Verified guided delivery with explicit artifact and recipient confirmation.", descriptionEs: "Entrega guiada verificada con confirmación explícita del artefacto y de los destinatarios.", family: "communications", module: "telegram", externalDelivery: true, confirmations: ["confirm_artifact"], dependencies: ["telegram.linking"], companyPolicy: true, projectPolicy: true, userPreference: true }),
  feature({ key: "navisworks.lens", nameEn: "Navisworks Lens platform", nameEs: "Plataforma Navisworks Lens", descriptionEn: "Verified integrated web-platform viewpoint lineage and reconciliation state; this does not claim plugin field acceptance.", descriptionEs: "Estado verificado e integrado de linaje y conciliación de puntos de vista en la plataforma web; no implica aceptación de campos del complemento.", family: "coordination", module: "navisworks_lens", companyPolicy: true, projectPolicy: true }),
  feature({ key: "ai.file_reading_control", nameEn: "File-reading AI control classification", nameEs: "Clasificación de control de IA para lectura de archivos", descriptionEn: "Verified control classification only, not a universal execution grant. Public evaluation always requires exact file and scope confirmation.", descriptionEs: "Solo clasificación de control verificada, no una autorización universal de ejecución. La evaluación pública siempre requiere confirmación exacta de archivos y alcance.", family: "ai", module: "ai_control_plane", ai: "file_reading_ai", fileReading: true, meter: "classification:file_reading_ai", payers: ["personal", "company", "system"], confirmations: ["confirm_ai_estimate"] }),
  feature({ key: "notifications.deterministic", nameEn: "Deterministic notifications", nameEs: "Notificaciones deterministas", descriptionEn: "Coming later. Product-wide customer notification adapters are not integrated, and the development notifier is not a customer capability.", descriptionEs: "Disponible más adelante. Los adaptadores de notificaciones para clientes no están integrados y el notificador de desarrollo no es una capacidad para clientes.", family: "communications", module: "notifications", status: "coming_later", ai: "deterministic_automation", meter: "zero_ai_credits", preference: null }),
  feature({ key: "concierge.click_driven", nameEn: "Concierge Assist", nameEs: "Concierge Assist", descriptionEn: "Coming later. Isolated click-driven controls do not yet form a canonical product-wide Concierge Assist surface.", descriptionEs: "Disponible más adelante. Los controles aislados activados por clic aún no forman una superficie canónica de Concierge Assist para todo el producto.", family: "concierge", module: "assist", status: "coming_later", ai: "deterministic_automation", preference: null }),
  feature({ key: "concierge.intelligence", nameEn: "Concierge Intelligence", nameEs: "Concierge Intelligence", descriptionEn: "Optional add-on planned for a later verified implementation.", descriptionEs: "Complemento opcional previsto para una implementación verificada posterior.", family: "concierge", module: "intelligence", status: "coming_later", ai: "text_ai", commercial: "addon", contract: "grant_and_restrict", dependencies: ["concierge.click_driven"] }),
  feature({ key: "concierge.proactive", nameEn: "Concierge Proactive", nameEs: "Concierge Proactive", descriptionEn: "Honest preview only; no proactive execution is implemented.", descriptionEs: "Solo vista previa honesta; no se ha implementado ejecución proactiva.", family: "concierge", module: "proactive", status: "preview", ai: "proactive_ai", commercial: "addon", dependencies: ["concierge.intelligence"] }),
  feature({ key: "concierge.executive", nameEn: "Concierge Executive", nameEs: "Concierge Executive", descriptionEn: "Honest preview only; no executive automation is implemented.", descriptionEs: "Solo vista previa honesta; no se ha implementado automatización ejecutiva.", family: "concierge", module: "executive", status: "preview", ai: "proactive_ai", commercial: "addon", dependencies: ["concierge.proactive"] }),
  feature({ key: "cost_financial_control", nameEn: "Cost & Financial Control", nameEs: "Control de costos y finanzas", descriptionEn: "Separate future product family; no payment or financial-control execution is implemented.", descriptionEs: "Familia de producto futura e independiente; no se ha implementado ejecución de pagos ni de control financiero.", family: "cost_financial_control", module: "foundation", status: "coming_later", tiers: ["business", "enterprise"], commercial: "tier_or_addon", contract: "grant_and_restrict" }),
  feature({ key: "geotwin_bim_10d", nameEn: "GeoTwin / BIM 10D", nameEs: "GeoTwin / BIM 10D", descriptionEn: "Future concept only; no operational GeoTwin or BIM 10D implementation is claimed.", descriptionEs: "Solo concepto futuro; no se declara ninguna implementación operativa de GeoTwin o BIM 10D.", family: "geotwin", module: "bim_10d", status: "coming_later", commercial: "tier_or_addon", contract: "grant_and_restrict" }),
];

export function initialFeature(featureKey: string): CatalogFeature | undefined {
  return INITIAL_FEATURE_CATALOG.find((item) => item.featureKey === featureKey);
}
