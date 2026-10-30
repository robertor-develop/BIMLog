import type { OAuthProviderKey } from "./oauth";
import { pool } from "@workspace/db";

export type ProviderOperation =
  | "catalog"
  | "authorize"
  | "callback"
  | "browse"
  | "import"
  | "disconnect"
  | "validate"
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
    label: { en: "BIMLog Lens Next for Navisworks", es: "BIMLog Lens Next para Navisworks" },
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
    ["outlook", "Microsoft Outlook"],
    ["onedrive", "OneDrive"],
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
  {
    key: "sharepoint",
    label: { en: "SharePoint", es: "SharePoint" },
    description: {
      en: "Available only after provider and customer approval.",
      es: "Disponible solo después de la aprobación del proveedor y del cliente.",
    },
    category: "governed",
    visibility: "governed",
    operations: ["catalog", "validate"],
  },
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

const persistedProcoreApprovals = new Set<number>();
let companyApprovalMigration: Promise<void> | null = null;

export function startCompanyProviderApprovalMigration(): Promise<void> {
  return companyApprovalMigration ?? (companyApprovalMigration = ensureCompanyProviderApprovalSchema());
}

async function ensureCompanyProviderApprovalSchema(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`CREATE TABLE IF NOT EXISTS company_provider_approval_events(
      sequence serial PRIMARY KEY,
      event_key text NOT NULL UNIQUE,
      company_id integer NOT NULL REFERENCES companies(id),
      provider_key text NOT NULL,
      operation text NOT NULL,
      enabled boolean NOT NULL,
      reason text NOT NULL,
      actor_user_id integer REFERENCES users(id),
      source text NOT NULL CHECK(source IN('owner_instruction','super_admin')),
      occurred_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT company_provider_approval_reason_chk CHECK(length(reason) BETWEEN 3 AND 1000)
    );
    CREATE INDEX IF NOT EXISTS company_provider_approval_latest_idx ON company_provider_approval_events(company_id,provider_key,operation,sequence DESC);
    CREATE OR REPLACE FUNCTION reject_company_provider_approval_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'company provider approval history is append-only'; END $$;
    DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='company_provider_approval_events_immutable' AND tgrelid='company_provider_approval_events'::regclass) THEN CREATE TRIGGER company_provider_approval_events_immutable BEFORE UPDATE OR DELETE ON company_provider_approval_events FOR EACH ROW EXECUTE FUNCTION reject_company_provider_approval_history_mutation(); END IF; END $$;`);
    await client.query(`INSERT INTO company_provider_approval_events(event_key,company_id,provider_key,operation,enabled,reason,actor_user_id,source)
      SELECT 'owner-approved-company-31-procore-all-operations',id,'procore','*',true,
      'Owner instruction: BIMLog internal Procore connector approval for current and future members of active BIMTECH CORP company 31. Procore account consent and source permissions remain required.',NULL,'owner_instruction'
      FROM companies WHERE id=31 AND retired_at IS NULL AND retired_into_company_id IS NULL
      ON CONFLICT(event_key) DO NOTHING`);
    const result = await client.query(`SELECT DISTINCT ON(e.company_id) e.company_id,e.enabled
      FROM company_provider_approval_events e JOIN companies c ON c.id=e.company_id
      WHERE e.provider_key='procore' AND e.operation='*' AND c.retired_at IS NULL AND c.retired_into_company_id IS NULL
      ORDER BY e.company_id,e.sequence DESC`);
    persistedProcoreApprovals.clear();
    for (const row of result.rows) if (row.enabled === true) persistedProcoreApprovals.add(Number(row.company_id));
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    companyApprovalMigration = null;
    throw error;
  } finally {
    client.release();
  }
}

export function providerOperationAllowedWithCompanyGrant(input: {
  provider: string;
  companyId: number | null;
  operation: ProviderOperation;
  approvedCompanyIds: ReadonlySet<number>;
  rawApprovals?: string;
}): boolean {
  const policy = providerPolicy(input.provider);
  if (!policy || !policy.operations.includes(input.operation)) return false;
  if (policy.visibility === "public") return true;
  if (input.provider === "procore" && input.companyId !== null && input.approvedCompanyIds.has(input.companyId)) return true;
  const tokens = approvalTokens(input.rawApprovals);
  const company = input.companyId === null ? "*" : String(input.companyId);
  return tokens.has(`${company}:${input.provider}:${input.operation}`)
    || tokens.has(`${company}:${input.provider}:*`);
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
  return providerOperationAllowedWithCompanyGrant({
    provider: key,
    companyId,
    operation,
    approvedCompanyIds: persistedProcoreApprovals,
    rawApprovals,
  });
}

/** Procore company approval is read from the current company record on every request. */
export async function isProviderOperationCurrentlyAllowed(
  key: string,
  companyId: number | null,
  operation: ProviderOperation,
  client: { query(text:string,values?:unknown[]):Promise<{rows:any[]}> } = pool,
): Promise<boolean> {
  if (key !== "procore") return isProviderOperationAllowed(key, companyId, operation);
  if (companyId === null) return false;
  const current = await client.query(`SELECT c.id,
      (SELECT e.enabled FROM company_provider_approval_events e
       WHERE e.company_id=c.id AND e.provider_key='procore'
         AND e.operation IN('*',$2) ORDER BY e.sequence DESC LIMIT 1) AS enabled
    FROM companies c WHERE c.id=$1 AND c.retired_at IS NULL AND c.retired_into_company_id IS NULL`,
    [companyId, operation]);
  if (!current.rows[0]) return false;
  return providerOperationAllowedWithCompanyGrant({
    provider:key,companyId,operation,
    approvedCompanyIds:current.rows[0].enabled === true ? new Set([companyId]) : new Set(),
  });
}

export function customerProviderCatalog(
  companyId: number,
  configured: (key: OAuthProviderKey) => boolean,
  rawApprovals?: string,
) {
  return PROVIDERS
    .filter((provider) => provider.key === "procore" || isProviderOperationAllowed(provider.key, companyId, "catalog", rawApprovals))
    .map((provider) => ({
      key: provider.key,
      label: provider.label,
      description: provider.description,
      category: provider.category,
      availability: provider.key === "procore" && !isProviderOperationAllowed(provider.key, companyId, "catalog", rawApprovals)
        ? "review_required"
        : provider.oauth
        ? (configured(provider.oauth) ? "available" : "setup_required")
        : (provider.visibility === "public" ? "available" : "review_required"),
      permissionState: isProviderOperationAllowed(provider.key, companyId, "catalog", rawApprovals) ? "approved" : "approval_required",
      configured: provider.oauth ? configured(provider.oauth) : true,
      oauthParam: provider.oauth?.replace(/_/g, "-") ?? null,
      route: provider.route ?? null,
    }));
}

export function isLegacyAutodeskAllowed(rawApprovals?: string): boolean {
  return isProviderOperationAllowed("legacy_autodesk", null, "legacy", rawApprovals);
}

export function isSharePointValidationAllowed(companyId: number, rawApprovals?: string): boolean {
  return isProviderOperationAllowed("sharepoint", companyId, "validate", rawApprovals);
}
