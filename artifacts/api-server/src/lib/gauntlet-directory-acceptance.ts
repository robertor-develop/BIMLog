import { createHash } from "node:crypto";

export type GauntletDirectoryCompany = { id: number; projectId: number; name: string; relationship: string; active: boolean };
export type GauntletDirectoryContact = { id: number; projectId: number; companyId: number; name: string; email: string; role: string; active: boolean };

export function inspectGauntletDirectory(input: {
  projectId: number;
  companies: readonly GauntletDirectoryCompany[];
  contacts: readonly GauntletDirectoryContact[];
  canRead: boolean;
  canExport: boolean;
}) {
  if (!Number.isSafeInteger(input.projectId) || input.projectId <= 0) throw new Error("GAUNTLET_DIRECTORY_PROJECT_INVALID");
  if (!input.canRead) throw new Error("GAUNTLET_DIRECTORY_READ_DENIED");
  if (input.companies.length < 2) throw new Error("GAUNTLET_DIRECTORY_TWO_COMPANIES_REQUIRED");
  const ids = new Set<number>();
  for (const company of input.companies) {
    if (!Number.isSafeInteger(company.id) || company.id <= 0 || company.projectId !== input.projectId || !company.name.trim() || !company.relationship.trim() || ids.has(company.id))
      throw new Error("GAUNTLET_DIRECTORY_COMPANY_INVALID");
    ids.add(company.id);
  }
  const contactIds = new Set<number>();
  for (const contact of input.contacts) {
    if (!Number.isSafeInteger(contact.id) || contact.id <= 0 || contact.projectId !== input.projectId || !ids.has(contact.companyId) || !contact.name.trim() || !contact.role.trim() || !/^\S+@\S+\.\S+$/.test(contact.email) || contactIds.has(contact.id))
      throw new Error("GAUNTLET_DIRECTORY_CONTACT_INVALID");
    contactIds.add(contact.id);
  }
  if (!input.contacts.some(contact => contact.active) || !input.contacts.some(contact => !contact.active))
    throw new Error("GAUNTLET_DIRECTORY_LIFECYCLE_UNPROVEN");
  const canonical = {
    projectId: input.projectId,
    companies: [...input.companies].sort((a, b) => a.id - b.id),
    contacts: [...input.contacts].sort((a, b) => a.id - b.id),
  };
  return Object.freeze({
    companyCount: input.companies.length,
    contactCount: input.contacts.length,
    activeContactCount: input.contacts.filter(contact => contact.active).length,
    inactiveContactCount: input.contacts.filter(contact => !contact.active).length,
    exportAllowed: input.canExport,
    fingerprint: createHash("sha256").update(JSON.stringify(canonical)).digest("hex"),
  });
}
