import assert from "node:assert/strict";
import { pricingErrorMessage } from "./company-pricing-errors.ts";

assert.equal(pricingErrorMessage({ code: "PRICING_TEMPLATE_TEXT_INVALID", field: "name" }, false), "Enter a template name before continuing.");
assert.equal(pricingErrorMessage({ code: "PRICING_TEMPLATE_TEXT_INVALID", field: "name" }, true), "Escriba un nombre para la plantilla antes de continuar.");
for (const payload of [{ code: "PRICING_TEMPLATE_TEXT_INVALID", field: "nodes[0].label" }, { code: "PRICING_TEMPLATE_CURRENCY_INVALID", field: "currency" }, { code: "PRICING_TEMPLATE_NODES_INVALID", field: "nodes" }]) {
  const message = pricingErrorMessage(payload, false);
  assert.ok(message.length > 20 && !message.includes(String(payload.code)));
}
console.log("COMPANY_PRICING_ERROR_UX=PASS bilingual validation is actionable without raw codes");
for (const es of [false, true]) {
  const codes = ["PRICING_TEMPLATE_MAKER_CHECKER_REQUIRED", "PRICING_TEMPLATE_FINANCE_APPROVER_REQUIRED", "PRICING_TEMPLATE_PMO_REQUIRED"];
  const messages = codes.map(code => pricingErrorMessage({ code }, es, 403));
  assert.equal(new Set(messages).size, 3);
  for (const message of messages) assert.ok(message.length > 40 && !message.includes("PRICING_TEMPLATE_"));
  assert.match(messages[0], es ? /Otro usuario PMO/ : /different PMO user/);
  assert.match(messages[1], es ? /financiera vigente/ : /current company Finance/);
  assert.notEqual(pricingErrorMessage({}, es, 403), pricingErrorMessage({}, es));
}
console.log("COMPANY_PRICING_AUTHORIZATION_UX=PASS distinct bilingual denials, no authority changes");
