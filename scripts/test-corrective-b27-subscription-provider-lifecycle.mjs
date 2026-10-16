import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const tsx="artifacts/api-server/node_modules/tsx/dist/cli.mjs";
for(const file of [
  "artifacts/api-server/src/lib/commercial-provider-events.behavior.ts",
  "artifacts/api-server/src/lib/commercial-subscription-lifecycle.behavior.ts",
  "artifacts/api-server/src/lib/commercial-portal-eligibility.behavior.ts",
  "artifacts/api-server/src/lib/commercial-portal-command.behavior.ts",
  "artifacts/api-server/src/routes/commercial-portal-recovery-route.behavior.ts",
]) execFileSync(process.execPath,[tsx,file],{stdio:"inherit"});
const events=readFileSync("artifacts/api-server/src/lib/commercial-provider-events.ts","utf8");
for(const event of ["customer.subscription.updated","customer.subscription.deleted","invoice.paid","invoice.payment_failed","charge.refunded"]) assert.ok(events.includes(event),event);
for(const state of ["past_due","cancelled","partial_refund","full_refund","unresolved"]) assert.ok(events.includes(state),state);
assert.match(events,/attemptCount >= 5/);
console.log("CORRECTIVE-B27 renewal, failure, cancellation, refund and reconciliation lifecycle: PASS");
