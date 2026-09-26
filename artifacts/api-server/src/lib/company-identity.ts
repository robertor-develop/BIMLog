/** Canonical identity resolution is for references, never a membership grant. */
export type CompanyIdentity = { id: number; retiredIntoCompanyId: number | null };
export async function resolveCompanyIdentity(
  id: number,
  read: (id: number) => Promise<CompanyIdentity | undefined>,
): Promise<number> {
  const visited = new Set<number>();
  let current = id;
  for (let depth = 0; depth < 16; depth++) {
    if (!Number.isSafeInteger(current) || current <= 0 || visited.has(current))
      throw new Error("COMPANY_IDENTITY_INVALID");
    visited.add(current);
    const row = await read(current);
    if (!row || row.id !== current) throw new Error("COMPANY_IDENTITY_MISSING");
    if (row.retiredIntoCompanyId === null) return current;
    current = row.retiredIntoCompanyId;
  }
  throw new Error("COMPANY_IDENTITY_DEPTH_EXCEEDED");
}

/** Candidate collision key, not legal identity or authorization proof. */
export function companyCollisionKey(name: string): string {
  return name.normalize("NFKC").toLocaleLowerCase("en-US").replace(/[\p{P}\p{Z}\s]/gu, "");
}

export function assertNewCompanyName(name: string, existingNames: string[]): void {
  const key = companyCollisionKey(name);
  if (!key || key.length > 200) throw new Error("COMPANY_NAME_INVALID");
  if (existingNames.some(existing => companyCollisionKey(existing) === key))
    throw new Error("COMPANY_JOIN_REQUIRED");
}
