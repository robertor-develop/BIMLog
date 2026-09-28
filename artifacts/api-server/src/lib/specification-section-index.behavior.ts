import assert from "node:assert/strict";
import { indexSpecificationSections, searchSpecificationSections } from "./specification-section-index";

const indexed = indexSpecificationSections({ projectId: 8, sections: [
  { id: "s1", projectId: 8, sectionNumber: "23 31 00", title: "HVAC Ducts", fileId: 41, fileRevisionId: "rev-b", pageStart: 12, pageEnd: 15, extractionState: "verified", extractedText: "Galvanized ductwork requirements" },
  { id: "s2", projectId: 8, sectionNumber: "26 05 00", title: "Electrical", fileId: 42, fileRevisionId: "rev-a", pageStart: 2, pageEnd: 4, extractionState: "uncertain", extractedText: "untrusted OCR" },
  { id: "foreign", projectId: 9, sectionNumber: "00", title: "Foreign", fileId: 99, fileRevisionId: "x", pageStart: 1, pageEnd: 1, extractionState: "absent" },
] });
assert.equal(indexed.length, 2, "project isolation excludes foreign specification sources");
assert.equal(searchSpecificationSections(indexed, "galvanized")[0]?.sourceUrl, "/projects/8/files/41/revisions/rev-b?page=12");
assert.equal(indexed[1]?.searchableText, null, "uncertain extraction is not represented as verified searchable content");
assert.match(indexed[1]?.sourceNotice ?? "", /uncertain/i);
assert.throws(() => indexSpecificationSections({ projectId: 8, sections: [{ ...indexed[0]!, extractedText: null }] }), /requires source text/);
console.log("C066 verified specification section index: PASS");
