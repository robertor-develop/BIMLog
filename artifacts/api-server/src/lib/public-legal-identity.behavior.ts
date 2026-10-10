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
assert.equal(JSON.stringify(complete).includes("TAX-TEST-1"), false);
assert.equal(JSON.stringify(complete).includes("REG-TEST-1"), false);
assert.equal(JSON.stringify(complete).includes("123 Test Avenue"), false);
assert.equal(JSON.stringify(complete).includes("billing@example.test"), false);

const defaulted = derivePublicLegalIdentity({});
assert.deepEqual(defaulted, {
  schemaVersion: "bimlog-public-legal-identity-v1",
  available: true,
  supplierName: "BIMCapital Partners INC",
  supportEmail: "info@ignitesmart.ai",
  invoiceJurisdiction: "Florida, United States",
});
const partial = derivePublicLegalIdentity({ BIMLOG_LEGAL_SUPPLIER_NAME: "Verified Public Supplier" });
assert.equal(partial.supplierName, "Verified Public Supplier");
assert.equal(partial.supportEmail, "info@ignitesmart.ai");
assert.equal(JSON.stringify(partial).includes("registrationNumber"), false);
console.log("LR006 safe public legal identity projection: PASS");
