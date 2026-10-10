import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const panel=readFileSync(new URL("./BillingIdentityPanel.tsx",import.meta.url),"utf8"),profile=readFileSync(new URL("../../pages/CompanyProfile.tsx",import.meta.url),"utf8"),workspace=readFileSync(new URL("../../pages/CommercialWorkspace.tsx",import.meta.url),"utf8");
for(const token of ["Billing identity","Identidad de facturación","Legal company name","Billing phone","Billing address","Billing identity complete","Save billing identity","Return to Billing & Support","readCommercialBillingIdentity","saveCommercialBillingIdentity"])assert.match(panel,new RegExp(token));
assert.match(profile,/BillingIdentityPanel/);assert.match(profile,/fromBilling=.*from.*billing/);
assert.match(workspace,/complete_billing_identity.*\?from=billing/);
assert.match(panel,/disabled aria-describedby="billing-legal-name-help"/);
console.log("LR034 bilingual billing identity return flow: PASS");
