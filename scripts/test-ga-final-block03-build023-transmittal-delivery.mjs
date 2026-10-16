import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
const routes = readFileSync("artifacts/api-server/src/routes/transmittals.ts", "utf8");
const tsx = path.resolve("artifacts/api-server/node_modules/tsx/dist/cli.mjs");
execFileSync(process.execPath, [tsx, path.resolve("artifacts/bimlog/src/lib/transmittal-operation-return.behavior.ts")], { stdio: "inherit" });
execFileSync(process.execPath, [path.resolve("artifacts/api-server/src/lib/post-p17-build37-transmittal-lifecycle.behavior.mjs")], { stdio: "inherit" });
for (const token of [
  'new Set(["all", "draft", "sent", "acknowledged", "failed", "cancelled"])',
  'triggerType: "transmittal_delivery"',
  'deliveryStatus === "sent" ? 200 : 502',
  'retained: true',
  'router.post("/projects/:projectId/transmittals/:transmittalId/cancel"',
  'actionType: "cancel"',
]) assert.ok(routes.includes(token), `Transmittal delivery contract is missing ${token}`);
assert.doesNotMatch(routes, /setImmediate\(async \(\) => \{[\s\S]{0,500}await sendEmail/);
assert.match(routes, /status: deliveryStatus, sentAt/);
assert.match(routes, /deliveryStatus === "sent" \? "send" : "delivery_failed"/);
console.log("GA-F03-B023 controlled transmittal delivery truth: PASS");
