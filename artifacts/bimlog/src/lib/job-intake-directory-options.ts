export type JobIntakeDirectoryEntry = {
  id: number | string;
  fullName?: string | null;
  email?: string | null;
  companyName?: string | null;
  companyId?: number | null;
};

const text = (value: unknown) => String(value ?? "").trim();

export function clientCompanyOptions(entries: JobIntakeDirectoryEntry[]) {
  return Array.from(
    new Set(entries.map((entry) => text(entry.companyName)).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));
}

export function authoritativeCompanyOptions(entries: JobIntakeDirectoryEntry[]) {
  const companies = new Map<number, string>();
  for (const entry of entries) {
    const id = Number(entry.companyId);
    const name = text(entry.companyName);
    if (Number.isSafeInteger(id) && id > 0 && name) companies.set(id, name);
  }
  return [...companies].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

export function primaryContactOptions(
  entries: JobIntakeDirectoryEntry[],
  selectedCompany: unknown,
) {
  const company = text(selectedCompany);
  if (!company) return [];
  return entries
    .filter((entry) => text(entry.companyName) === company && text(entry.fullName))
    .sort((a, b) => text(a.fullName).localeCompare(text(b.fullName)));
}

export function contactBelongsToCompany(
  entries: JobIntakeDirectoryEntry[],
  selectedCompany: unknown,
  selectedContact: unknown,
) {
  const company = text(selectedCompany);
  const contact = text(selectedContact);
  return Boolean(
    company &&
      contact &&
      entries.some(
        (entry) =>
          text(entry.companyName) === company && text(entry.fullName) === contact,
      ),
  );
}
