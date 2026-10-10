import assert from "node:assert/strict";
import fs from "node:fs";

const source=fs.readFileSync(new URL("./CommercialWorkspace.tsx",import.meta.url),"utf8");
for(const copy of ["Update payment method","Actualizar método de pago","Review cancellation","Revisar cancelación","Manage billing","Administrar facturación"])assert.ok(source.includes(copy),copy);
assert.match(source,/disabled=\{billingBusy\|\|!data\.portalEligibility\.ready\}/);
assert.match(source,/portalEligibility\.purpose==="recover_payment"/);
assert.match(source,/portalEligibility\.purpose==="review_cancellation"/);
assert.doesNotMatch(source,/subscriptionStatus!=="active"\|\|!data\.providerCustomerBound/);
console.log("LR065 bilingual subscription recovery controls: PASS");
