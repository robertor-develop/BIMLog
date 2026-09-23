import assert from "node:assert/strict";
import { pricingErrorMessage } from "./company-pricing-errors.ts";

assert.equal(pricingErrorMessage({ code: "PRICING_TEMPLATE_TEXT_INVALID", field: "name" }, false), "Enter a template name before continuing.");
assert.equal(pricingErrorMessage({ code: "PRICING_TEMPLATE_TEXT_INVALID", field: "name" }, true), "Escriba un nombre para la plantilla antes de continuar.");
for (const payload of [{ code: "PRICING_TEMPLATE_TEXT_INVALID", field: "nodes[0].label" }, { code: "PRICING_TEMPLATE_CURRENCY_INVALID", field: "currency" }, { code: "PRICING_TEMPLATE_NODES_INVALID", field: "nodes" }]) {
  const message = pricingErrorMessage(payload, false);
  assert.ok(message.length > 20 && !message.includes(String(payload.code)));
}
console.log("COMPANY_PRICING_ERROR_UX=PASS bilingual validation is actionable without raw codes");
