import assert from "node:assert/strict";
import {
  resolveLensCompanyDirectoryReference,
  resolveWebCompanyDirectoryReference,
  type CompanyDirectoryCandidate,
} from "./company-directory-resolution";

const candidates: CompanyDirectoryCandidate[] = [
  { companyId: 31, canonicalCompanyId: 31, companyName: "BIMTECH CORP", source: "company" },
  { companyId: 35, canonicalCompanyId: 31, companyName: "BIMtech 35", source: "directory_alias" },
  { companyId: 44, canonicalCompanyId: 44, companyName: "Other BIMTECH", source: "company" },
];
const input = { companyId: 35, companyName: "BIMtech 35", candidates };
assert.deepEqual(resolveWebCompanyDirectoryReference(input), resolveLensCompanyDirectoryReference(input));
assert.deepEqual(resolveLensCompanyDirectoryReference(input), {
  canonicalCompanyId: 31,
  displayName: "BIMTECH CORP",
  historicalValue: "BIMtech 35",
  resolution: "canonical_id",
});
assert.equal(resolveWebCompanyDirectoryReference({ companyName: "BIMTECH CORP", candidates }).canonicalCompanyId, 31);
assert.throws(() => resolveWebCompanyDirectoryReference({
  companyName: "Same Company",
  candidates: [
    { companyId: 1, canonicalCompanyId: 1, companyName: "Same Company", source: "company" },
    { companyId: 2, canonicalCompanyId: 2, companyName: "Same-Company", source: "company" },
  ],
}), /COMPANY_REFERENCE_AMBIGUOUS/);
assert.deepEqual(resolveLensCompanyDirectoryReference({ companyName: "Historic Trade Name", candidates }), {
  canonicalCompanyId: null,
  displayName: "Historic Trade Name",
  historicalValue: "Historic Trade Name",
  resolution: "historical_only",
});
console.log("C022 canonical company/directory resolution: PASS");
