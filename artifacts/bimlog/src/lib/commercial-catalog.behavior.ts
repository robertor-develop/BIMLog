import assert from "node:assert/strict";
import { BILLING_TERMS, CATALOG_PRICES, COMMERCIAL_ADDONS, addonsForPlan, priceSnapshot, publishedPriceFor, quotedTerm } from "./commercial-catalog";

assert.equal(CATALOG_PRICES.length, 5);
assert.deepEqual(CATALOG_PRICES.map((price) => price.planId), ["free", "professional", "team", "business", "enterprise"]);
assert.equal(publishedPriceFor("professional", "2026-09-30").monthlyAmount, 149);
assert.equal(publishedPriceFor("business", "2027-01-01").annualAmount, 3990);
assert.deepEqual(priceSnapshot(publishedPriceFor("team", "2026-10-01")), {
  planId: "team", priceVersion: 1, currency: "USD", monthlyAmount: 249, annualAmount: 2490, effectiveFrom: "2026-09-30",
});
assert.throws(() => publishedPriceFor("free", "not-a-date"), /valid YYYY-MM-DD/);
assert.equal(BILLING_TERMS.monthly.serviceMonths, 1);
assert.equal(BILLING_TERMS.annual.serviceMonths, 12);
assert.equal(quotedTerm("professional", "monthly", "2026-10-01").amount, 149);
assert.equal(quotedTerm("professional", "annual", "2026-10-01").amount, 1490);
assert.equal(quotedTerm("team", "annual", "2026-10-01").cancellationEffective, "term_end");
assert.deepEqual(COMMERCIAL_ADDONS.map((addon) => addon.id), ["project_capacity", "approved_connector", "extended_retention"]);
assert.equal(addonsForPlan("free").length, 0);
assert.deepEqual(addonsForPlan("business").map((addon) => addon.id), ["project_capacity", "approved_connector", "extended_retention"]);
assert.ok(COMMERCIAL_ADDONS.every((addon) => addon.price === "custom_quote" && addon.availability === "review_required"));

console.log("Commercial catalog Builds 006-008 prices, terms and governed add-ons: PASS");
