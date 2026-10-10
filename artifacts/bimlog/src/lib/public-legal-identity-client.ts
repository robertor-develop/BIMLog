export type PublicLegalIdentityDto = Readonly<{
  schemaVersion: "bimlog-public-legal-identity-v1";
  available: boolean;
  supplierName: string | null;
  supportEmail: string | null;
  invoiceJurisdiction: string | null;
}>;

function nullableString(value: unknown) {
  if (value === null) return null;
  if (typeof value !== "string" || !value.trim() || value.length > 254) throw new Error("Invalid public legal identity");
  return value;
}

export function parsePublicLegalIdentity(value: unknown): PublicLegalIdentityDto {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid public legal identity");
  const row = value as Record<string, unknown>;
  const allowed = new Set(["schemaVersion", "available", "supplierName", "supportEmail", "invoiceJurisdiction"]);
  if (Object.keys(row).some(key => !allowed.has(key))) throw new Error("Invalid public legal identity");
  if (row.schemaVersion !== "bimlog-public-legal-identity-v1" || typeof row.available !== "boolean") throw new Error("Invalid public legal identity");
  const result = {
    schemaVersion: row.schemaVersion,
    available: row.available,
    supplierName: nullableString(row.supplierName),
    supportEmail: nullableString(row.supportEmail),
    invoiceJurisdiction: nullableString(row.invoiceJurisdiction),
  } as const;
  if (result.available !== [result.supplierName, result.supportEmail, result.invoiceJurisdiction].every(Boolean)) throw new Error("Invalid public legal identity");
  return result;
}

export async function fetchPublicLegalIdentity(signal?: AbortSignal) {
  const response = await fetch("/api/v1/public/legal-identity", { signal, headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Public legal identity could not be loaded");
  return parsePublicLegalIdentity(await response.json());
}
