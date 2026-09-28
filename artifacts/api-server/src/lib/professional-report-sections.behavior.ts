import assert from "node:assert/strict";
import { combineProfessionalReportSections } from "./professional-report-sections";

const rfi = { domain: "rfi" as const, id: "RFI-9", version: 3, title: "Opening", sourceUrl: "/projects/26/rfis/9" };
const report = combineProfessionalReportSections([
  rfi,
  { ...rfi, title: "Duplicate presentation row" },
  { domain: "submittal", id: "SUB-4", version: 2, title: "Duct package", sourceUrl: "/projects/26/submittals/4" },
  { domain: "meeting", id: "MTG-2", version: 1, title: "Coordination", sourceUrl: "/projects/26/meetings/2" },
  { domain: "baseline", id: "BL-7", version: 1, title: "Week 7", sourceUrl: "/projects/26/reports/baselines/7" },
]);
assert.equal(report.totalDistinctRecords, 4, "presentation joins must not duplicate business rows");
assert.equal(report.sections.reduce((sum, section) => sum + section.count, 0), 4);
assert.equal(report.sections[0].rows[0]?.sourceUrl, "/projects/26/rfis/9", "source reference must survive generation");
console.log("C047 combined canonical coordination report sections: PASS");
