/** Presentation over the authorized project directory; never an authorization store. */
export type ProjectParty = {
  id?: number | string;
  companyId?: number | null;
  companyName?: string | null;
  fullName?: string | null;
  email?: string | null;
  role?: string | null;
};

export function projectCompanyNames(entries: readonly ProjectParty[], selected = "") {
  const names = new Set(entries.map(row => row.companyName?.trim()).filter((name): name is string => !!name));
  // A saved document name is a historical snapshot, not a new directory record.
  if (selected.trim()) names.add(selected.trim());
  return [...names].sort((a, b) => a.localeCompare(b));
}

export function projectCompanyIdentities(entries: readonly ProjectParty[]) {
  const companies = new Map<number, string>();
  for (const entry of entries) {
    if (Number.isSafeInteger(entry.companyId) && Number(entry.companyId) > 0 && entry.companyName?.trim()) {
      companies.set(entry.companyId!, entry.companyName.trim());
    }
  }
  return [...companies].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}
