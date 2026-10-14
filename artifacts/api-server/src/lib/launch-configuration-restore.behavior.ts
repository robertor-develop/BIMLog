import assert from "node:assert/strict";
import { prepareLaunchConfigurationRestore } from "./launch-configuration-restore";
const complete:any={businessIdentity:{legalBusinessName:"Synthetic Supplier",tradeName:"Synthetic",businessIdentificationNumber:"TEST-1",country:"Test",jurisdiction:"Test",businessAddress:"1 Test",billingAddress:"1 Test",supportEmail:"support@example.test",billingEmail:"billing@example.test",termsUrl:"https://example.test/terms",privacyUrl:"https://example.test/privacy"},emailDelivery:{provider:"smtp",senderAddress:"sender@example.test",senderDomain:"example.test",smtpHost:"smtp.example.test",smtpPort:587,smtpUsername:"synthetic",smtpPasswordSecretReference:"encrypted:v1"},enabledPaymentMethods:["bank_transfer"],bankTransfer:{bankName:"Synthetic Bank",accountHolder:"Synthetic",accountIdentifier:"TEST",currency:"USD",country:"Test",instructions:"Synthetic only",referenceInstructions:"Use synthetic reference"},qrPayment:{},paymentProvider:{}};
const restored=prepareLaunchConfigurationRestore({current:{...complete,secretEnvelopes:{smtpPassword:{ciphertext:"current"}}},historical:{...complete,secretEnvelopes:{smtpPassword:{ciphertext:"retired"}}}});
assert.deepEqual(restored.configuration.secretEnvelopes,{smtpPassword:{ciphertext:"current"}});
assert.notEqual((restored.configuration.secretEnvelopes as any).smtpPassword.ciphertext,"retired");
assert.equal(restored.state,"draft");
console.log("Build 42 launch configuration restore semantics: PASS current secrets preserved historical secrets denied");
