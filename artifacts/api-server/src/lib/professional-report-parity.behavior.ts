import assert from "node:assert/strict";
import { generateProfessionalReportOutputs, verifyProfessionalReportParity } from "./professional-report-parity";

const rows = [
  { domain: "rfi" as const, id: "RFI-1", version: 2, title: "Opening", sourceUrl: "/projects/26/rfis/1" },
  { domain: "submittal" as const, id: "SUB-2", version: 4, title: "Duct", sourceUrl: "/projects/26/submittals/2" },
];
const settings = { pageSize: "LETTER" as const, orientation: "landscape" as const, marginMm: 12, header: "BIMTECH", footer: "Official report", rowsPerPage: 20 };
const first = generateProfessionalReportOutputs({ rows, settings, approvedPackage: true });
const repeated = generateProfessionalReportOutputs({ rows: [...rows].reverse(), settings, approvedPackage: true });
assert.deepEqual(verifyProfessionalReportParity(first), { pass: true, recordCount: 2, reproductionKey: first.reproductionKey });
assert.equal(first.reproductionKey, repeated.reproductionKey, "saved settings and source versions must reproduce the same report");
assert.equal(first.pdf.officialRecord, true);
assert.equal(first.xlsx.officialRecord, true);
assert.throws(() => verifyProfessionalReportParity({ ...first, xlsx: { ...first.xlsx, recordKeys: ["rfi:RFI-1:v1"] } }), /PROFESSIONAL_REPORT_OUTPUT_PARITY_FAILED/);
console.log("C050 PDF, Excel and official-record parity: PASS");
