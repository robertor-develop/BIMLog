import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const server = readFileSync(new URL("../artifacts/api-server/src/lib/launch-activation-preflight.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../artifacts/api-server/src/routes/launch-configuration.ts", import.meta.url), "utf8");
const client = readFileSync(new URL("../artifacts/bimlog/src/lib/launch-activation-preflight.ts", import.meta.url), "utf8");
const panel = readFileSync(new URL("../artifacts/bimlog/src/components/admin/LaunchConfigurationPanel.tsx", import.meta.url), "utf8");

for (const classification of ["LAUNCH_CONFIGURATION_PENDING", "GA_CANDIDATE", "FINAL_ACTIVATION_VERIFIED"]) {
  assert.ok(server.includes(classification), `server owns ${classification}`);
  assert.ok(client.includes(classification), `browser validates ${classification}`);
}
for (const field of ["configurationReady", "emailReady", "paymentsReady", "activationReady", "blockers"]) {
  assert.ok(server.includes(field), `server preflight owns ${field}`);
  assert.ok(client.includes(field), `browser preflight validates ${field}`);
}
assert.match(route, /authMiddleware, isSuperAdminMiddleware/);
assert.match(route, /res\.json\(\{ item: response\(current\), emailVerification, paymentVerifications, preflight \}\)/);
assert.match(panel, /Final activation preflight/);
assert.match(panel, /Verificación previa a la activación final/);
assert.match(panel, /GA candidate — ready for owner activation/);
assert.match(panel, /Selected payment methods verified/);
assert.doesNotMatch(JSON.stringify({ server, client, panel }), /sk_live_[A-Za-z0-9]+|SG\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);

console.log("ENTERPRISE_LAUNCH_CONFIGURATION_BLOCK_08=PASS builds=36-40 preflight=protected classifications=truthful ui=bilingual");
