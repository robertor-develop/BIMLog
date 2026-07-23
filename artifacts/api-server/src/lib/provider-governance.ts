import type { OAuthProviderKey } from "./oauth";

export type ProviderOperation =
  | "catalog"
  | "authorize"
  | "callback"
  | "browse"
  | "import"
  | "disconnect"
  | "legacy";

type ProviderVisibility = "public" | "governed" | "private";

interface ProviderPolicy {
  key: string;
  label: { en: string; es: string };
  description: { en: string; es: string };
  category: "file_source" | "open_format" | "first_party" | "governed";
  visibility: ProviderVisibility;
  operations: readonly ProviderOperation[];
  oauth?: OAuthProviderKey;
  route?: string;
}

// This registry is the single customer-facing provider authority. Restricted
// entries remain dormant unless a company-specific approval is supplied by the
// deployment environment. Threat rationale intentionally never leaves the server.
const PROVIDERS: readonly ProviderPolicy[] = [
  {
    key: "ifc_openbim",
    label: { en: "IFC / openBIM", es: "IFC / openBIM" },
    description: {
      en: "Open-format file validation and exchange.",
      es: "Validación e intercambio de archivos en formato abierto.",
    },
    category: "open_format",
    visibility: "public",
    operations: ["catalog"],
    route: "files",
  },
  {
    key: "document_exchange",
    label: { en: "Document exchange", es: "Intercambio de documentos" },
    description: {
      en: "Import and export supported Excel, CSV, PDF, and project files.",
      es: "Importa y exporta archivos de proyecto, Excel, CSV y PDF compatibles.",
    },
    category: "open_format",
    visibility: "public",
    operations: ["catalog"],
    route: "files",
  },
  {
    key: "navisworks_lens",
    label: { en: "BIMLog Lens for Navisworks", es: "BIMLog Lens para Navisworks" },
    description: {
      en: "First-party Navisworks coordination workflow.",
      es: "Flujo de coordinación propio para Navisworks.",
    },
    category: "first_party",
    visibility: "public",
    operations: ["catalog"],
    route: "clash-reports",
  },
  {
    key: "google_drive",
    label: { en: "Google Drive", es: "Google Drive" },
    description: {
      en: "Read-only file source when the connector is configured.",
      es: "Fuente de archivos de solo lectura cuando el conector está configurado.",
    },
    category: "file_source",
    visibility: "public",
    operations: ["catalog", "authorize", "callback", "browse", "import", "disconnect"],
    oauth: "google_drive",
  },
  {
    key: "dropbox",
    label: { en: "Dropbox", es: "Dropbox" },
    description: {
      en: "Read-only file source when the connector is configured.",
      es: "Fuente de archivos de solo lectura cuando el conector está configurado.",
    },
    category: "file_source",
    visibility: "public",
    operations: ["catalog", "authorize", "callback", "browse", "import", "disconnect"],
    oauth: "dropbox",
  },
  ...([
    ["speckle", "Speckle"],
    ["microsoft_project", "Microsoft Project"],
    ["power_bi", "Power BI"],
    ["onedrive", "OneDrive"],
    ["sharepoint", "SharePoint"],
    ["bluebeam", "Bluebeam"],
    ["smartsheet", "Smartsheet"],
    ["box", "Box"],
    ["egnyte", "Egnyte"],
    ["matterport", "Matterport"],
    ["dronedeploy", "DroneDeploy"],
    ["esri", "Esri"],
    ["ec3_openepd", "EC3 / OpenEPD"],
    ["madaster", "Madaster"],
    ["lca_eam_digital_twin", "LCA / EAM / digital twin tools"],
  ] as const).map(([key, label]) => ({
    key,
    label: { en: label, es: label },
    description: {
      en: "Available only after provider and customer approval.",
      es: "Disponible solo después de la aprobación del proveedor y del cliente.",
    },
    category: "governed" as const,
    visibility: "governed" as const,
    operations: ["catalog"] as const,
  })),
  ...([
    ["procore", "Procore", "procore"],
    ["bim360", "Autodesk construction cloud", "bim360"],
    ["aconex", "Aconex", undefined],
    ["plangrid", "PlanGrid", undefined],
    ["trimble", "Trimble", undefined],
    ["ebuilder", "e-Builder", undefined],
    ["kahua", "Kahua", undefined],
    ["newforma", "Newforma", undefined],
    ["fieldwire", "Fieldwire", undefined],
  ] as const).map(([key, label, oauth]) => ({
    key,
    label: { en: label, es: label },
    description: {
      en: "Private connector available only under an approved customer agreement.",
      es: "Conector privado disponible solo bajo un acuerdo de cliente aprobado.",
    },
    category: "governed" as const,
    visibility: "private" as const,
    operations: oauth
      ? (["catalog", "authorize", "callback", "browse", "import", "disconnect"] as const)
      : (["catalog"] as const),
    oauth: oauth as OAuthProviderKey | undefined,
  })),
  {
    key: "legacy_autodesk",
    label: { en: "Legacy Autodesk adapter", es: "Adaptador heredado de Autodesk" },
    description: { en: "", es: "" },
    category: "governed",
    visibility: "private",
    operations: ["legacy"],
  },
];

function approvalTokens(raw = process.env.BIMLOG_PROVIDER_APPROVALS || ""): Set<string> {
  return new Set(raw.split(",").map((value) => value.trim()).filter(Boolean));
}

export function providerPolicy(key: string): ProviderPolicy | undefined {
  return PROVIDERS.find((provider) => provider.key === key);
}

export function isProviderOperationAllowed(
  key: string,
  companyId: number | null,
  operation: ProviderOperation,
  rawApprovals?: string,
): boolean {
  const policy = providerPolicy(key);
  if (!policy || !policy.operations.includes(operation)) return false;
  if (policy.visibility === "public") return true;
  const tokens = approvalTokens(rawApprovals);
  const company = companyId === null ? "*" : String(companyId);
  return tokens.has(`${company}:${key}:${operation}`)
    || tokens.has(`${company}:${key}:*`);
}

export function customerProviderCatalog(
  companyId: number,
  configured: (key: OAuthProviderKey) => boolean,
  rawApprovals?: string,
) {
  return PROVIDERS
    .filter((provider) => isProviderOperationAllowed(provider.key, companyId, "catalog", rawApprovals))
    .map((provider) => ({
      key: provider.key,
      label: provider.label,
      description: provider.description,
      category: provider.category,
      availability: provider.oauth
        ? (configured(provider.oauth) ? "available" : "setup_required")
        : (provider.visibility === "public" ? "available" : "review_required"),
      oauthParam: provider.oauth?.replace(/_/g, "-") ?? null,
      route: provider.route ?? null,
    }));
}

export function isLegacyAutodeskAllowed(rawApprovals?: string): boolean {
  return isProviderOperationAllowed("legacy_autodesk", null, "legacy", rawApprovals);
}
