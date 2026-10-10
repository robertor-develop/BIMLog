import assert from "node:assert/strict";
import {commercialLaunchProfileConfigurationKeys,deriveCommercialLaunchProfile} from "./commercial-launch-profile";

const empty=deriveCommercialLaunchProfile({},new Date("2026-10-09T14:00:00.000Z"));
assert.equal(empty.complete,false);assert.equal(empty.missingFields.length,7);assert.equal(empty.checkedAt,"2026-10-09T14:00:00.000Z");
const complete=deriveCommercialLaunchProfile({
  BIMLOG_LEGAL_SUPPLIER_NAME:"BIMCapital Partners INC",
  BIMLOG_LEGAL_SUPPLIER_REGISTRATION:"PENDING-VERIFIED-VALUE",
  BIMLOG_LEGAL_TAX_ID:"PENDING-VERIFIED-VALUE",
  BIMLOG_LEGAL_BILLING_EMAIL:"billing@example.com",
  BIMLOG_LEGAL_SUPPORT_EMAIL:"support@example.com",
  BIMLOG_LEGAL_ADDRESS:"7901 4th Street North, STE 300, St. Petersburg, FL 33702",
  BIMLOG_INVOICE_JURISDICTION:"United States",
});
assert.equal(complete.complete,true);assert.deepEqual(complete.missingFields,[]);assert.equal(complete.billingEmail,"billing@example.com");
assert.deepEqual(commercialLaunchProfileConfigurationKeys(["taxIdentifier","supportEmail"]),["BIMLOG_LEGAL_TAX_ID","BIMLOG_LEGAL_SUPPORT_EMAIL"]);
assert.equal(deriveCommercialLaunchProfile({BIMLOG_LEGAL_BILLING_EMAIL:"invalid"}).billingEmail,null);
console.log("Launch Block 1 Build 1 canonical supplier profile: PASS");
