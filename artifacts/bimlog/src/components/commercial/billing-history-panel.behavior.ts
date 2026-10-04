import fs from "node:fs";
import assert from "node:assert/strict";
const panel=fs.readFileSync(new URL("./BillingHistoryPanel.tsx",import.meta.url),"utf8"),page=fs.readFileSync(new URL("../../pages/CommercialWorkspace.tsx",import.meta.url),"utf8");
for(const token of ["Billing history","Historial de facturación","Loading billing history","Billing history unavailable","No invoices have been recorded","Payment disputes","Provider credentials and payment methods are never shown","requestCommercialBillingHistory"])assert.match(panel,new RegExp(token));
assert.match(panel,/role="status"/);assert.match(panel,/role="alert"/);assert.match(panel,/repeat\(auto-fit,minmax\(min\(150px,100%\),1fr\)\)/);
assert.match(page,/data\.billingAuthority\.canManageBilling&&<BillingHistoryPanel token=/);
assert.doesNotMatch(panel,/providerInvoiceReference|providerDisputeReference|payloadDigest|rawPayload|customerReference/);
console.log("B244 bilingual responsive billing history UI: PASS");
