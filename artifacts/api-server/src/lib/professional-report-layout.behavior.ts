import assert from "node:assert/strict";
import { layoutProfessionalReport } from "./professional-report-layout";

const settings = { pageSize: "A4" as const, orientation: "landscape" as const, marginMm: 12, header: "BIMTECH CORP — Project 26", footer: "Controlled coordination report", rowsPerPage: 2 };
const rows = [
  { key: "1", cells: ["RFI-1", " Open "], screenshot: { width: 1600, height: 900, alt: "RFI model context" } },
  { key: "2", cells: ["SUB-2", "Approved"] },
  { key: "3", cells: ["MTG-3", "Closed"] },
];
const first = layoutProfessionalReport(rows, settings);
const second = layoutProfessionalReport(rows, settings);
assert.equal(first.pages.length, 2, "pagination must not create blank filler pages");
assert.deepEqual(first.pages.map(page => page.rows.length), [2, 1]);
assert.equal(first.pages[0].rows[0].screenshot?.fit, "contain", "screenshots must remain readable without clipping");
assert.equal(first.layoutFingerprint, second.layoutFingerprint, "saved layout settings must reproduce exactly");
assert.throws(() => layoutProfessionalReport([], { ...settings, header: "" }), /REPORT_LAYOUT_HEADER_FOOTER_REQUIRED/);
console.log("C048 reproducible report preview and page layout: PASS");
