import assert from "node:assert/strict";
import { resolveEmailReadiness } from "./email-readiness";
assert.equal(resolveEmailReadiness(null), "not_configured");
assert.equal(resolveEmailReadiness({ provider: "sendgrid", status: "saved" }), "configured");
assert.equal(resolveEmailReadiness({ provider: "sendgrid", status: "connected" }), "unverified");
assert.equal(resolveEmailReadiness({ provider: "sendgrid", status: "verified" }), "ready");
assert.equal(resolveEmailReadiness({ provider: "sendgrid", status: "error", lastError: "rejected" }), "error");
console.log("UX146_EMAIL_READINESS=PASS states=5 optional_setup=true");
