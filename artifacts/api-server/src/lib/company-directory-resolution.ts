import { companyCollisionKey } from "./company-identity";

export type CompanyDirectoryCandidate = {
  companyId: number;
  canonicalCompanyId: number;
  companyName: string;
  source: "company" | "directory_alias" | "historical_value";
};

export type CompanyDirectoryResolution = {
  canonicalCompanyId: number | null;
  displayName: string;
  historicalValue: string;
  resolution: "canonical_id" | "unique_alias" | "historical_only";
};

/** Shared web/Lens resolver. Names discover candidates but never merge companies. */
export function resolveCompanyDirectoryReference(input: {
  companyId?: number | null;
  companyName: string;
  candidates: readonly CompanyDirectoryCandidate[];
}): CompanyDirectoryResolution {
  const historicalValue = input.companyName.trim();
  if (!historicalValue) throw new Error("COMPANY_REFERENCE_EMPTY");

  if (input.companyId != null) {
    const exact = input.candidates.filter((row) => row.companyId === input.companyId);
    const canonicalIds = new Set(exact.map((row) => row.canonicalCompanyId));
    if (canonicalIds.size !== 1) throw new Error("COMPANY_REFERENCE_ID_UNRESOLVED");
    const canonicalCompanyId = [...canonicalIds][0];
    const canonical = input.candidates.find((row) => row.companyId === canonicalCompanyId && row.source === "company")
      ?? exact.find((row) => row.source === "company")
      ?? exact[0];
    return { canonicalCompanyId, displayName: canonical.companyName, historicalValue, resolution: "canonical_id" };
  }

  const key = companyCollisionKey(historicalValue);
  const matches = input.candidates.filter((row) => companyCollisionKey(row.companyName) === key);
  const canonicalIds = new Set(matches.map((row) => row.canonicalCompanyId));
  if (canonicalIds.size > 1) throw new Error("COMPANY_REFERENCE_AMBIGUOUS");
  if (canonicalIds.size === 1) {
    const canonicalCompanyId = [...canonicalIds][0];
    const canonical = input.candidates.find((row) => row.companyId === canonicalCompanyId && row.source === "company") ?? matches[0];
    return { canonicalCompanyId, displayName: canonical.companyName, historicalValue, resolution: "unique_alias" };
  }
  return { canonicalCompanyId: null, displayName: historicalValue, historicalValue, resolution: "historical_only" };
}

export const resolveWebCompanyDirectoryReference = resolveCompanyDirectoryReference;
export const resolveLensCompanyDirectoryReference = resolveCompanyDirectoryReference;
