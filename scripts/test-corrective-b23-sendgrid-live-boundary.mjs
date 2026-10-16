import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const tsx="artifacts/api-server/node_modules/tsx/dist/cli.mjs";
execFileSync(process.execPath,[tsx,"artifacts/api-server/src/lib/commercial-sendgrid-live-verification.behavior.ts"],{stdio:"inherit"});
const source=readFileSync("artifacts/api-server/src/lib/commercial-sendgrid-live-verification.ts","utf8");
for(const token of ["/v3/user/profile","/v3/verified_senders","sendgrid_account_unusable","sendgrid_sender_unusable","support_inbox_valid"]) assert.ok(source.includes(token),token);
assert.match(source,/item\.verified===true/);
assert.doesNotMatch(source,/console\.(log|error)\([^\n]*(key|authorization)/i);
console.log("CORRECTIVE-B23 SendGrid account, verified sender and support inbox boundary: PASS; real delivery: REQUIRES CONFIGURATION");
