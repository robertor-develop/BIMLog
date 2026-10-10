import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const profile=readFileSync(new URL("../../pages/CompanyProfile.tsx",import.meta.url),"utf8"),workspace=readFileSync(new URL("../../pages/CommercialWorkspace.tsx",import.meta.url),"utf8");
for(const token of ["Billing identity","Identidad de facturación","Legal company name","Billing phone","Billing address","Missing","Save billing identity","Return to Billing & Support","readCommercialBillingIdentity","saveCommercialBillingIdentity"])assert.match(profile,new RegExp(token));
assert.match(profile,/fromBilling.*from.*billing/);
assert.match(workspace,/complete_billing_identity.*\?from=billing/);
assert.match(profile,/value=\{billing\.legalName\} disabled/);
console.log("LR034 bilingual billing identity return flow: PASS");
