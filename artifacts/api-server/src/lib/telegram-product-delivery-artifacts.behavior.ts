import assert from "node:assert/strict";
import { TELEGRAM_DELIVERY_ARTIFACTS } from "./telegram-delivery-artifacts";

const routes = TELEGRAM_DELIVERY_ARTIFACTS;
assert.equal(routes.rfi_pdf.route, "/projects/{projectId}/rfis/{entityId}/export");
assert.equal(routes.submittal_pdf.route, "/projects/{projectId}/submittals/{entityId}/export");
assert.equal(routes.submittal_docx.route, "/projects/{projectId}/submittals/{entityId}/export-word");
assert.equal(routes.submittal_audit_pdf.route, "/projects/{projectId}/submittals/{entityId}/audit-certificate");
assert.equal(routes.change_order_pdf.route, "/projects/{projectId}/change-orders/{entityId}/export");
assert.equal(routes.submittal_pdf.contentType, "application/pdf");
assert.equal(routes.change_order_pdf.contentType, "application/pdf");

console.log("PASS Telegram canonical delivery artifact coverage");
