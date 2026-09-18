import { FinancialControlError } from "./financial-control-contract";
import { validatePricingTemplate } from "./company-pricing-template-contract";
import { waitForGenericApuPersistenceMigration } from "./generic-apu-persistence-migration";

type Queryable = { query(sql: string, values?: unknown[]): Promise<{ rows: any[] }> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PricingTemplateBinding = {
  templateId: string;
  versionId: string;
  version: number;
  name: string;
  currency: string;
  fingerprint: string;
  evaluatedTotal: string;
  status: "reference_only";
};

export async function resolveCompanyPricingTemplateBinding(input: {
  client: Queryable;
  companyId: number;
  currency: string;
  versionId: unknown;
}): Promise<PricingTemplateBinding | null> {
  if (input.versionId == null || input.versionId === "") return null;
  if (typeof input.versionId !== "string" || !uuid.test(input.versionId))
    throw new FinancialControlError(400, "PRICING_TEMPLATE_VERSION_INVALID", "A valid published pricing-template version is required.");
  await waitForGenericApuPersistenceMigration();
  const row = (await input.client.query(`SELECT id,template_id,version,name,currency,content_fingerprint,provenance
    FROM generic_apu_template_versions WHERE id=$1 AND company_id=$2 AND project_id IS NULL AND status='published'`,
    [input.versionId,input.companyId])).rows[0];
  if (!row) throw new FinancialControlError(404, "PRICING_TEMPLATE_VERSION_NOT_FOUND", "This published pricing template is unavailable to the company.");
  // The publisher uses this same lock, so a contract transaction cannot pin a
  // version while a newer version is being published concurrently.
  await input.client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [row.template_id]);
  const latest = (await input.client.query(`SELECT id,status FROM generic_apu_template_versions
    WHERE template_id=$1 AND company_id=$2 AND project_id IS NULL AND status IN('published','retired')
    ORDER BY version DESC LIMIT 1`, [row.template_id,input.companyId])).rows[0];
  if (latest?.status === "retired") throw new FinancialControlError(409, "PRICING_TEMPLATE_RETIRED", "This pricing template was retired and cannot be selected for a new contract.");
  if (latest?.id !== row.id) throw new FinancialControlError(409, "PRICING_TEMPLATE_VERSION_SUPERSEDED", "Select the current published pricing-template version.");
  if (row.currency !== input.currency) throw new FinancialControlError(409, "PRICING_TEMPLATE_CURRENCY_MISMATCH", "Pricing-template and contract currencies must match.");
  let validated: ReturnType<typeof validatePricingTemplate>;
  try { validated = validatePricingTemplate(row.provenance?.definition); }
  catch { throw new FinancialControlError(409, "PRICING_TEMPLATE_DEFINITION_INVALID", "The published pricing-template definition failed verification."); }
  if (validated.fingerprint !== row.content_fingerprint || validated.fingerprint !== row.provenance?.definitionFingerprint)
    throw new FinancialControlError(409, "PRICING_TEMPLATE_FINGERPRINT_MISMATCH", "The published pricing-template definition failed verification.");
  return {
    templateId: row.template_id,
    versionId: row.id,
    version: Number(row.version),
    name: row.name,
    currency: row.currency,
    fingerprint: validated.fingerprint,
    evaluatedTotal: validated.preview.roundedTotal,
    status: "reference_only",
  };
}
