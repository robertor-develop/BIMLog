import assert from "node:assert/strict";
import { derivePublicLegalIdentity } from "./public-legal-identity";

const complete = derivePublicLegalIdentity({
  BIMLOG_LEGAL_SUPPLIER_NAME: "Synthetic Supplier LLC",
  BIMLOG_LEGAL_SUPPLIER_REGISTRATION: "REG-TEST-1",
  BIMLOG_LEGAL_TAX_ID: "TAX-TEST-1",
  BIMLOG_LEGAL_BILLING_EMAIL: "billing@example.test",
  BIMLOG_LEGAL_SUPPORT_EMAIL: "support@example.test",
  BIMLOG_LEGAL_ADDRESS: "123 Test Avenue",
  BIMLOG_INVOICE_JURISDICTION: "Test jurisdiction",
});
assert.equal(complete.available, true);
assert.equal(complete.supplierName, "Synthetic Supplier LLC");
assert.equal(JSON.stringify(complete).includes("BIMLOG_LEGAL_"), false);

const incomplete = derivePublicLegalIdentity({ BIMLOG_LEGAL_SUPPLIER_NAME: "Partial" });
assert.equal(incomplete.available, false);
assert.equal(incomplete.supplierName, null, "partial legal identity must not be published");
assert.equal(Object.values(incomplete).includes("Partial"), false);
console.log("LR006 complete-only public legal identity projection: PASS");
