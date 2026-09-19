import assert from "node:assert/strict";
import { coordinationExportModel, coordinationRegisterView, type CoordinationRegisterRow } from "./construction-coordination-records";

const rows: CoordinationRegisterRow[] = [
  { identity: { projectId: 53, type: "rfi", id: 1, version: 2 }, number: "RFI-001", title: "Sleeve clearance", status: "open", responsibleCompany: "Acme MEP", updatedAt: "2026-09-19T20:00:00.000Z" },
  { identity: { projectId: 53, type: "rfi", id: 2, version: 1 }, number: "RFI-002", title: "Duct elevation", status: "responded", responsibleCompany: "Acme MEP", updatedAt: "2026-09-19T21:00:00.000Z" },
  { identity: { projectId: 53, type: "submittal", id: 3, version: 4 }, number: "SUB-003", title: "Damper schedule", status: "approved", responsibleCompany: "Acme MEP", updatedAt: "2026-09-19T22:00:00.000Z" },
  { identity: { projectId: 53, type: "rfi", id: 4, version: 1 }, number: "RFI-004", title: "Concrete opening", status: "open", responsibleCompany: "Structure Co", updatedAt: "2026-09-19T23:00:00.000Z" },
];
const view = {
  id: "open-acme-rfis",
  projectId: 53,
  name: "Open Acme RFIs",
  filters: { types: ["rfi" as const], statuses: ["open"], responsibleCompanies: ["Acme MEP"], search: "sleeve" },
  sort: "updated_desc" as const,
  pageSize: 1,
};
const firstPage = coordinationRegisterView({ rows, view, page: 1 });
assert.equal(firstPage.totalRows, 1);
assert.equal(firstPage.visibleRows[0].number, "RFI-001");
assert.equal(firstPage.page, 1);
assert.equal(firstPage.totalPages, 1);

const exported = coordinationExportModel(firstPage);
assert.equal(exported.totalRows, firstPage.totalRows);
assert.deepEqual(exported.filters, view.filters);
assert.deepEqual(exported.rows.map((row) => row.key), firstPage.filteredRows.map((row) => `53:${row.identity.type}:${row.identity.id}`));
assert.match(exported.csv, /53:rfi:1,2,rfi,RFI-001,Sleeve clearance,open,Acme MEP/);
assert.doesNotMatch(exported.csv, /RFI-002|SUB-003|RFI-004/);

assert.throws(() => coordinationRegisterView({ rows: [{ ...rows[0], identity: { ...rows[0].identity, projectId: 54 } }], view, page: 1 }), /another project/);
console.log("block 13 build 064 register and export parity: PASS");
