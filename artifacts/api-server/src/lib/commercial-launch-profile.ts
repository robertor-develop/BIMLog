export const commercialLaunchProfileFields = [
  "supplierName",
  "registrationNumber",
  "taxIdentifier",
  "billingEmail",
  "supportEmail",
  "registeredAddress",
  "invoiceJurisdiction",
] as const;

export type CommercialLaunchProfileField = typeof commercialLaunchProfileFields[number];
export type CommercialLaunchProfile = Readonly<{
  status: "complete" | "incomplete";
  complete: boolean;
  supplierName: string | null;
  registrationNumber: string | null;
  taxIdentifier: string | null;
  billingEmail: string | null;
  supportEmail: string | null;
  registeredAddress: string | null;
  invoiceJurisdiction: string | null;
  missingFields: readonly CommercialLaunchProfileField[];
  checkedAt: string;
}>;

const keys: Readonly<Record<CommercialLaunchProfileField, string>> = Object.freeze({
  supplierName: "BIMLOG_LEGAL_SUPPLIER_NAME",
  registrationNumber: "BIMLOG_LEGAL_SUPPLIER_REGISTRATION",
  taxIdentifier: "BIMLOG_LEGAL_TAX_ID",
  billingEmail: "BIMLOG_LEGAL_BILLING_EMAIL",
  supportEmail: "BIMLOG_LEGAL_SUPPORT_EMAIL",
  registeredAddress: "BIMLOG_LEGAL_ADDRESS",
  invoiceJurisdiction: "BIMLOG_INVOICE_JURISDICTION",
});

function clean(value: string | undefined, max = 240) {
  const normalized = value?.trim() ?? "";
  return normalized && normalized.length <= max ? normalized : null;
}

function email(value: string | undefined) {
  const normalized = clean(value, 254);
  return normalized && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized.toLowerCase() : null;
}

export function deriveCommercialLaunchProfile(environment: NodeJS.ProcessEnv, now = new Date()): CommercialLaunchProfile {
  const values = {
    supplierName: clean(environment[keys.supplierName], 160),
    registrationNumber: clean(environment[keys.registrationNumber], 100),
    taxIdentifier: clean(environment[keys.taxIdentifier], 100),
    billingEmail: email(environment[keys.billingEmail]),
    supportEmail: email(environment[keys.supportEmail]),
    registeredAddress: clean(environment[keys.registeredAddress], 320),
    invoiceJurisdiction: clean(environment[keys.invoiceJurisdiction], 120),
  };
  const missingFields = commercialLaunchProfileFields.filter(field => values[field] === null);
  const complete = missingFields.length === 0;
  return Object.freeze({
    status: complete ? "complete" : "incomplete",
    complete,
    ...values,
    missingFields: Object.freeze([...missingFields]),
    checkedAt: now.toISOString(),
  });
}

export function commercialLaunchProfileConfigurationKeys(fields: readonly CommercialLaunchProfileField[]) {
  return fields.map(field => keys[field]);
}
