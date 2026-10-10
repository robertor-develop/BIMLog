import assert from "node:assert/strict";
import { parsePublicLegalIdentity } from "./public-legal-identity-client";

const available = parsePublicLegalIdentity({schemaVersion:"bimlog-public-legal-identity-v1",available:true,supplierName:"Supplier",supportEmail:"support@example.test",invoiceJurisdiction:"Florida"});
assert.equal(available.supplierName, "Supplier");
assert.throws(() => parsePublicLegalIdentity({...available, taxIdentifier:"secret"}));
assert.throws(() => parsePublicLegalIdentity({...available, available:false}));
const unavailable = parsePublicLegalIdentity({schemaVersion:"bimlog-public-legal-identity-v1",available:false,supplierName:null,supportEmail:null,invoiceJurisdiction:null});
assert.equal(unavailable.available, false);
console.log("LR008 strict public legal identity browser contract: PASS");
