import assert from "node:assert/strict";
import { paymentActivationBlockers } from "./launch-payment-activation";

assert.deepEqual(paymentActivationBlockers({ selectedMethods:["bank_transfer"], configurationRevision:3, evidence:[{method:"bank_transfer",mode:"manual",status:"configured",revision:3}], production:true }),[]);
assert.deepEqual(paymentActivationBlockers({ selectedMethods:["qr_payment"], configurationRevision:3, evidence:[], production:true }),["qr_payment_verification_missing"]);
assert.deepEqual(paymentActivationBlockers({ selectedMethods:["stripe"], configurationRevision:4, evidence:[{method:"stripe",mode:"sandbox",status:"verified",revision:4}], production:true }),["stripe_production_verification_missing"]);
assert.deepEqual(paymentActivationBlockers({ selectedMethods:["stripe"], configurationRevision:4, evidence:[{method:"stripe",mode:"production",status:"verified",revision:4}], production:true }),[]);
console.log("LAUNCH_PAYMENT_BUILD_29=PASS revisionBound=true productionModeBound=true manualSafe=true");
