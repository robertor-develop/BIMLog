import assert from "node:assert/strict";
import { companyFullCommercialGrantApplies } from "./commercial-entitlement";
import {
  customerProviderCatalog,
  providerOperationAllowedWithCompanyGrant,
  type ProviderOperation,
} from "./provider-governance";

const approved = new Set([31]);
assert.equal(companyFullCommercialGrantApplies({ userCompanyId: 31, grantCompanyId: 31, companyActive: true, enabled: true }), true, "current member receives the company grant");
assert.equal(companyFullCommercialGrantApplies({ userCompanyId: 31, grantCompanyId: 31, companyActive: true, enabled: true }), true, "future members assigned to the canonical company receive the same grant");
assert.equal(companyFullCommercialGrantApplies({ userCompanyId: 38, grantCompanyId: 31, companyActive: true, enabled: true }), false, "separate Bimtech company is excluded");
assert.equal(companyFullCommercialGrantApplies({ userCompanyId: 31, grantCompanyId: 31, companyActive: false, enabled: true }), false, "retired company membership is excluded");
assert.equal(companyFullCommercialGrantApplies({ userCompanyId: 38, grantCompanyId: 31, companyActive: true, enabled: true }), false, "membership removal stops inheritance");

for (const operation of ["catalog", "authorize", "callback", "browse", "import", "disconnect"] as ProviderOperation[]) {
  assert.equal(providerOperationAllowedWithCompanyGrant({ provider: "procore", companyId: 31, operation, approvedCompanyIds: approved, rawApprovals: "" }), true, `company 31 receives Procore ${operation} approval`);
  assert.equal(providerOperationAllowedWithCompanyGrant({ provider: "procore", companyId: 38, operation, approvedCompanyIds: approved, rawApprovals: "" }), false, `company 38 does not receive Procore ${operation} approval`);
}
assert.equal(providerOperationAllowedWithCompanyGrant({ provider: "procore", companyId: null, operation: "browse", approvedCompanyIds: approved, rawApprovals: "" }), false, "unscoped actor is not approved");
assert.equal(providerOperationAllowedWithCompanyGrant({ provider: "procore", companyId: 31, operation: "legacy", approvedCompanyIds: approved, rawApprovals: "" }), false, "approval does not enable unsupported operations");

const setupOnly = customerProviderCatalog(31, () => false, "31:procore:*").find((provider) => provider.key === "procore");
assert.equal(setupOnly?.permissionState, "approved", "internal approval is visible independently");
assert.equal(setupOnly?.availability, "setup_required", "missing OAuth app remains an honest, separate setup state");
const otherCompany = customerProviderCatalog(38, () => true, "31:procore:*").find((provider) => provider.key === "procore");
assert.equal(otherCompany?.permissionState, "approval_required");
assert.equal(otherCompany?.availability, "review_required");

console.log("Company 31 commercial entitlement and Procore approval isolation: PASS");
