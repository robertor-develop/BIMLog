import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const tsx="artifacts/api-server/node_modules/tsx/dist/cli.mjs";
for(const file of [
  "artifacts/api-server/src/lib/launch-email-provider.behavior.ts",
  "artifacts/api-server/src/lib/launch-email-provider-live.behavior.ts",
  "artifacts/api-server/src/lib/launch-email-activation.behavior.ts",
  "artifacts/api-server/src/lib/accountability-outbox.behavior.ts",
  "artifacts/api-server/src/lib/support-case-notification.behavior.ts",
]) execFileSync(process.execPath,[tsx,file],{stdio:"inherit"});
execFileSync(process.execPath,["node_modules/tsx/dist/cli.mjs","src/lib/launch-email-routes.behavior.ts"],{stdio:"inherit",cwd:"artifacts/api-server"});
const transport=readFileSync("artifacts/api-server/src/lib/sendgrid-transport.ts","utf8");
for(const token of ["timeoutMs: 10_000","maxRequestBytes","maxResponseBytes","maxRedirects: 0"]) assert.ok(transport.includes(token),token);
const email=readFileSync("artifacts/api-server/src/lib/email.ts","utf8");
for(const token of ["SENDGRID_API_KEY","setApiKey","status: \"skipped\"","status: \"sent\"","status: \"failed\""]) assert.ok(email.includes(token),token);
assert.doesNotMatch(`${transport}\n${email}`,/console\.(log|error)\([^\n]*(apiKey|authorization)/i);
console.log("CORRECTIVE-B28 transactional-email provider, outbox, activation and support notifications: PASS; live delivery: REQUIRES CONFIGURATION");
