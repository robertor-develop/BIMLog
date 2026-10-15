import assert from "node:assert/strict";
import { inspectGauntletDirectory } from "./gauntlet-directory-acceptance";

const companies = [
  { id: 701, projectId: 64001, name: "Synthetic Client", relationship: "client", active: true },
  { id: 702, projectId: 64001, name: "Synthetic Designer", relationship: "consultant", active: true },
];
const contacts = [
  { id: 801, projectId: 64001, companyId: 701, name: "Synthetic Client Lead", email: "client@example.test", role: "company_lead", active: true },
  { id: 802, projectId: 64001, companyId: 702, name: "Synthetic Former Drafter", email: "inactive@example.test", role: "drafter", active: false },
];
const accepted = inspectGauntletDirectory({ projectId: 64001, companies, contacts, canRead: true, canExport: true });
assert.deepEqual({ companies: accepted.companyCount, active: accepted.activeContactCount, inactive: accepted.inactiveContactCount }, { companies: 2, active: 1, inactive: 1 });
assert.equal(accepted.exportAllowed, true);
assert.throws(() => inspectGauntletDirectory({ projectId: 64001, companies, contacts, canRead: false, canExport: false }), /READ_DENIED/);
assert.throws(() => inspectGauntletDirectory({ projectId: 64001, companies: companies.slice(0, 1), contacts, canRead: true, canExport: true }), /TWO_COMPANIES_REQUIRED/);
assert.throws(() => inspectGauntletDirectory({ projectId: 64001, companies, contacts: contacts.map(contact => ({ ...contact, active: true })), canRead: true, canExport: true }), /LIFECYCLE_UNPROVEN/);
assert.throws(() => inspectGauntletDirectory({ projectId: 64001, companies, contacts: [{ ...contacts[0], companyId: 999 }], canRead: true, canExport: true }), /CONTACT_INVALID/);
console.log("B-GA013 project-scoped directory, lifecycle, export, and denial contract: PASS");
