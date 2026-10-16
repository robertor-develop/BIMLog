import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const tsx="artifacts/api-server/node_modules/tsx/dist/cli.mjs";
for(const file of ["commercial-stripe-live-verification.behavior.ts","commercial-stripe-service-verification.behavior.ts","commercial-provider-webhook.behavior.ts"])
  execFileSync(process.execPath,[tsx,`artifacts/api-server/src/lib/${file}`],{stdio:"inherit"});
const account=readFileSync("artifacts/api-server/src/lib/commercial-stripe-live-verification.ts","utf8");
const service=readFileSync("artifacts/api-server/src/lib/commercial-stripe-service-verification.ts","utf8");
for(const token of ["/v1/account","charges_enabled","livemode","/v1/prices/"]) assert.ok(account.includes(token),token);
for(const token of ["/v1/webhook_endpoints?limit=100","checkout.session.completed","/v1/billing_portal/configurations/"]) assert.ok(service.includes(token),token);
assert.doesNotMatch(`${account}\n${service}`,/console\.(log|error)\([^\n]*(key|authorization)/i);
console.log("CORRECTIVE-B22 Stripe account/catalog/webhook/portal verification boundary: PASS; real provider calls: REQUIRES CONFIGURATION");
