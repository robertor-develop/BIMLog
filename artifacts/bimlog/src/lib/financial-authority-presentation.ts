import { formatOptionalInstantDate } from "@workspace/api-zod";

/** Entitlement grants have no recorded start date; their epoch is an authorization sentinel. */
export function financialAuthorityDate(grant: { grantId: string; effectiveFrom: unknown }, lang: string): string {
  if (grant.grantId.startsWith("commercial-entitlement:")) {
    return lang === "es" ? "Incluido con acceso Comercial" : "Included with Commercial access";
  }
  return formatOptionalInstantDate(grant.effectiveFrom, lang === "es" ? "es" : "en-US", lang === "es" ? "Sin registrar" : "Not recorded");
}
