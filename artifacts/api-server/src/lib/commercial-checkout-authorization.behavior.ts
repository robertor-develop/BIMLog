import assert from "node:assert/strict";
import {deriveCommercialCheckoutAuthorization,requireCommercialCheckoutAuthorization} from "./commercial-checkout-authorization";
import type {CommercialLaunchAuthorization} from "./commercial-launch-authorization";

const base={sourceCommit:"a".repeat(40),receipt:null,evaluatedAt:"2026-10-10T17:00:00.000Z"};
const current={...base,status:"current",ready:true} as CommercialLaunchAuthorization;
assert.deepEqual(deriveCommercialCheckoutAuthorization(current),{ready:true,status:"current",blockers:[]});
for(const [status,blocker] of [["missing","verification_missing"],["source_mismatch","verification_source_mismatch"],["expired","verification_expired"],["not_verified","verification_failed"]] as const){
  const authorization={...base,status,ready:false} as CommercialLaunchAuthorization;
  assert.deepEqual(deriveCommercialCheckoutAuthorization(authorization).blockers,[blocker]);
  assert.throws(()=>requireCommercialCheckoutAuthorization(authorization),error=>error instanceof Error&&(error as Error&{code?:string}).code==="CHECKOUT_LIVE_VERIFICATION_REQUIRED");
}
assert.equal(requireCommercialCheckoutAuthorization(current).ready,true);
console.log("LR046 source-bound checkout authorization: PASS");
