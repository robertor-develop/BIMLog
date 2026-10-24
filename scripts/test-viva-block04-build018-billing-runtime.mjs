import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const tsx = "artifacts/api-server/node_modules/tsx/dist/cli.mjs";
for (const file of ["commercial-checkout-command.behavior.ts", "commercial-provider-webhook.behavior.ts", "commercial-portal-command.behavior.ts"]) {
  const target = `artifacts/api-server/src/lib/${file}`;
  const run = spawnSync(process.execPath, [tsx, target], { encoding: "utf8", timeout: 120_000 });
  assert.equal(run.status, 0, `${file}\n${run.stdout ?? ""}\n${run.stderr ?? run.error ?? ""}`);
}
console.log("VIVA_BLOCK04_BUILD018=PASS checkout=true webhook_signature=true portal_recovery=true");
