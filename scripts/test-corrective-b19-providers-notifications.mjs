import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
execFileSync(process.execPath,["artifacts/api-server/node_modules/tsx/dist/cli.mjs","artifacts/api-server/src/lib/block16-build078-notification-determinism.behavior.ts"],{stdio:"inherit"});
const oauth=readFileSync("artifacts/api-server/src/lib/oauth.ts","utf8");
const cloud=readFileSync("artifacts/api-server/src/lib/cloud-files.ts","utf8");
const notifications=readFileSync("artifacts/api-server/src/lib/telegram-product-notifications.ts","utf8");
const center=readFileSync("artifacts/bimlog/src/components/notifications/NotificationPreferenceCenter.tsx","utf8");
for(const provider of ["google_drive","dropbox","bim360","procore"]) {assert.ok(oauth.includes(`${provider}: {`),provider);assert.ok(cloud.includes(`case "${provider}"`),provider);}
for(const token of ["provider_acknowledgement_id","PROVIDER_OUTCOME_UNKNOWN","PROVIDER_REJECTED","attempt_count","delivered","failed"]) assert.ok(notifications.includes(token),token);
assert.match(center,/Email · \{tt\("Coming Later","Disponible más adelante"\)/);
assert.match(center,/Last successful/);assert.match(center,/Last failed/);assert.match(center,/Test notification/);
console.log("CORRECTIVE-B19 provider boundaries and notification evidence/failure/retry contract: PASS");
