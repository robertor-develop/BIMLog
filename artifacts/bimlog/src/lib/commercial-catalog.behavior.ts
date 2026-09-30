import assert from "node:assert/strict";
import { CATALOG_PRICES, priceSnapshot, publishedPriceFor } from "./commercial-catalog";

assert.equal(CATALOG_PRICES.length, 5);
assert.deepEqual(CATALOG_PRICES.map((price) => price.planId), ["free", "professional", "team", "business", "enterprise"]);
assert.equal(publishedPriceFor("professional", "2026-09-30").monthlyAmount, 149);
assert.equal(publishedPriceFor("business", "2027-01-01").annualAmount, 3990);
assert.deepEqual(priceSnapshot(publishedPriceFor("team", "2026-10-01")), {
  planId: "team", priceVersion: 1, currency: "USD", monthlyAmount: 249, annualAmount: 2490, effectiveFrom: "2026-09-30",
});
assert.throws(() => publishedPriceFor("free", "not-a-date"), /valid YYYY-MM-DD/);

console.log("Commercial catalog Build 006 versioned prices: PASS");
