import { projectCompanyNames, projectCompanyIdentities } from "./project-party-options";
export type JobIntakeDirectoryEntry = {
  id: number | string;
  fullName?: string | null;
  email?: string | null;
  companyName?: string | null;
  companyId?: number | null;
};

const text = (value: unknown) => String(value ?? "").trim();

export function clientCompanyOptions(entries: JobIntakeDirectoryEntry[]) {
  return projectCompanyNames(entries);
}

export function authoritativeCompanyOptions(entries: JobIntakeDirectoryEntry[]) {
  return projectCompanyIdentities(entries);
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
