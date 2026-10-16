import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const tsx="artifacts/api-server/node_modules/tsx/dist/cli.mjs";
for(const file of [
  "artifacts/api-server/src/lib/commercial-checkout-authorization.behavior.ts",
  "artifacts/api-server/src/lib/commercial-checkout-readiness.behavior.ts",
  "artifacts/api-server/src/lib/commercial-checkout-command.behavior.ts",
  "artifacts/api-server/src/lib/commercial-subscription-setup.behavior.ts",
  "artifacts/api-server/src/lib/commercial-subscription-setup-persistence.behavior.ts",
  "artifacts/api-server/src/routes/commercial-checkout-summary-route.behavior.ts",
]) execFileSync(process.execPath,[tsx,file],{stdio:"inherit"});
const route=readFileSync("artifacts/api-server/src/routes/commercial-workspace.ts","utf8");
for(const token of ["/commercial/checkout","/commercial/subscription-setup","CHECKOUT_LIVE_VERIFICATION_REQUIRED","BILLING_AUTHORITY_REQUIRED","CHECKOUT_AUTHORITY_CONFLICT"]) assert.ok(route.includes(token),token);
console.log("CORRECTIVE-B26 tenant-scoped subscription setup and checkout lifecycle: PASS");
