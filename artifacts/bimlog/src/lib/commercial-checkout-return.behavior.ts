import assert from "node:assert/strict";
import {parseCommercialCheckoutReturn} from "./commercial-checkout-return";
assert.equal(parseCommercialCheckoutReturn("?checkout=success&session_id=cs_test_redacted"),"success");
assert.equal(parseCommercialCheckoutReturn("?checkout=cancelled"),"cancelled");
assert.equal(parseCommercialCheckoutReturn("?checkout=complete"),null);
assert.equal(parseCommercialCheckoutReturn("?checkout=https%3A%2F%2Fevil.example"),null);
console.log("B075 bounded commercial checkout return feedback: PASS");
