import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const tsx="artifacts/api-server/node_modules/tsx/dist/cli.mjs";
for(const file of ["public-commercial-availability.behavior.ts","commercial-launch-activation.behavior.ts","commercial-launch-live-verification.behavior.ts"])
  execFileSync(process.execPath,[tsx,`artifacts/api-server/src/lib/${file}`],{stdio:"inherit"});
const client=readFileSync("artifacts/bimlog/src/lib/commercial-launch-client.ts","utf8");
const keys=["BIMLOG_STRIPE_PRICE_IDS","BIMLOG_COMMERCIAL_MODE","STRIPE_SECRET_KEY","BIMLOG_APP_ORIGIN","STRIPE_WEBHOOK_SECRET","STRIPE_PORTAL_CONFIGURATION_ID","SENDGRID_API_KEY","BIMLOG_SUPPORT_FROM_EMAIL","BIMLOG_SUPPORT_INBOX_EMAIL"];
for(const key of keys) assert.ok(client.includes(`\"${key}\"`),`missing approved launch key ${key}`);
assert.equal((client.match(/[A-Z][A-Z0-9_]{4,}/g)||[]).filter(value=>value.includes("STRIPE")||value.includes("SENDGRID")||value.includes("BIMLOG_")).filter((value,index,all)=>all.indexOf(value)===index).sort().join("\n"),keys.slice().sort().join("\n"));
const availability=readFileSync("artifacts/api-server/src/lib/public-commercial-availability.ts","utf8");
assert.match(availability,/paidPlans: paidReady \? "available" : "consultation_only"/);
assert.match(availability,/nextAction: paidReady \? "create_free_account" : "request_plan_consultation"/);
console.log("CORRECTIVE-B24 exact nine-key launch boundary and truthful public availability: PASS");
