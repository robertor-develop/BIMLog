import assert from "node:assert/strict";
import {
  isLaunchReadinessState,
  launchReadinessStates,
  ownerReservedLaunchFields,
  inspectBusinessIdentity,
  inspectEmailDelivery,
  maskSecretReference,
  inspectBankTransfer,
  inspectQrPayment,
  inspectLaunchConfiguration,
} from "./launch-configuration";

assert.equal(launchReadinessStates.length, 6);
assert.equal(isLaunchReadinessState("GA_CANDIDATE_CONFIGURATION_READY"), true);
assert.equal(isLaunchReadinessState("GENERAL_AVAILABILITY_APPROVED"), true);
assert.equal(isLaunchReadinessState("READY"), false);
assert.equal(new Set(ownerReservedLaunchFields).size, ownerReservedLaunchFields.length);

const incompleteIdentity = inspectBusinessIdentity({ legalBusinessName: "Synthetic Test Company" });
assert.equal(incompleteIdentity.status, "invalid");
assert.ok(incompleteIdentity.issues.includes("country_required"));

const readyIdentity = inspectBusinessIdentity({
  legalBusinessName: "Synthetic Test Company",
  tradeName: "Synthetic BIM",
  businessIdentificationNumber: "TEST-0001",
  country: "Test Country",
  jurisdiction: "Test Jurisdiction",
  businessAddress: "100 Test Avenue",
  billingAddress: "100 Test Avenue",
  supportEmail: "support@example.test",
  billingEmail: "billing@example.test",
});
assert.equal(readyIdentity.status, "ready");
assert.deepEqual(readyIdentity.issues, []);

const smtp = inspectEmailDelivery({ provider: "smtp", senderAddress: "mail@example.test", senderDomain: "example.test", smtpHost: "smtp.example.test", smtpPort: 587, smtpUsername: "synthetic-user", smtpPasswordSecretReference: "secret://test/smtp", active: true });
assert.equal(smtp.status, "active");
const sendgrid = inspectEmailDelivery({ provider: "sendgrid", senderAddress: "mail@example.test", senderDomain: "example.test", sendgridApiKeySecretReference: "secret://test/sendgrid" });
assert.equal(sendgrid.status, "ready");
assert.equal(inspectEmailDelivery({ provider: "smtp", senderAddress: "invalid", senderDomain: "invalid" }).status, "invalid");
assert.equal(maskSecretReference("secret://test/sendgrid"), "secr••••grid");
assert.equal(maskSecretReference(undefined), null);

const qr = inspectQrPayment({ qrAssetReference: "asset://synthetic/qr", beneficiaryName: "Synthetic Test Company", currency: "tst", country: "Test Country", instructions: "Synthetic payment only", active: true });
assert.equal(qr.status, "active");
assert.equal(qr.value?.currency, "TST");
const bank = inspectBankTransfer({ bankName: "Synthetic Bank", accountHolder: "Synthetic Test Company", accountIdentifier: "TEST-0001", routingInformation: "TEST-ROUTE", currency: "TST", country: "Test Country", instructions: "Synthetic transfer only", referenceInstructions: "Use synthetic invoice reference" });
assert.equal(bank.status, "ready");
assert.ok(inspectBankTransfer({}).issues.includes("routingInformation_required"));

const readiness = inspectLaunchConfiguration({
  businessIdentity: readyIdentity.value ?? {},
  emailDelivery: { provider: "smtp", senderAddress: "mail@example.test", senderDomain: "example.test", smtpHost: "smtp.example.test", smtpPort: 587, smtpUsername: "synthetic-user", smtpPasswordSecretReference: "secret://test/smtp", active: true },
  qrPayment: qr.value ?? {},
  bankTransfer: bank.value ?? {},
  stripeEnabled: false,
});
assert.equal(readiness.readinessState, "LAUNCH_CONFIGURATION_ENTERED");
assert.equal(readiness.stripe.status, "disabled");
assert.equal(readiness.emailDelivery.value?.smtpPasswordSecretReference, undefined);
const ownerPending = inspectLaunchConfiguration({ businessIdentity: {}, emailDelivery: {}, qrPayment: {}, bankTransfer: {}, stripeEnabled: false });
assert.equal(ownerPending.readinessState, "GA_CANDIDATE_CONFIGURATION_READY");
assert.equal(ownerPending.gaCandidateConfigurationReady, true);
assert.deepEqual(ownerPending.blockers, ["business_identity", "email_delivery", "qr_payment", "bank_transfer"]);

console.log("LAUNCH_CONFIGURATION_BUILD_01=PASS states=6 ownerReserved=true");
console.log("LAUNCH_CONFIGURATION_BUILD_02=PASS syntheticBusinessIdentity=true");
console.log("LAUNCH_CONFIGURATION_BUILD_03=PASS emailProviders=smtp,sendgrid secrets=masked-reference-only");
console.log("LAUNCH_CONFIGURATION_BUILD_04=PASS manualPayments=qr,bank-transfer jurisdictionNeutral=true");
console.log("LAUNCH_CONFIGURATION_BUILD_05=PASS aggregateReadiness=true stripeDefault=disabled secretsExcluded=true");
