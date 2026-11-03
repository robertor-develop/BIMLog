import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const route = readFileSync("artifacts/api-server/src/routes/telegram-product.ts", "utf8");
const app = readFileSync("artifacts/api-server/src/app.ts", "utf8");
const profile = readFileSync("artifacts/bimlog/src/pages/Profile.tsx", "utf8");
const operations = readFileSync("artifacts/bimlog/src/pages/TelegramOperations.tsx", "utf8");
const directory = readFileSync("artifacts/bimlog/src/lib/capability-directory.ts", "utf8");

const boundary = route.slice(route.indexOf("function requireTelegramWebhook"), route.indexOf('router.get("/integrations/telegram/status"'));
for (const contract of [
  "requireTelegramProductConfig", "timingSafeEqualText", "req.params.adapterId", "config.adapterId",
  'req.get("x-telegram-bot-api-secret-token")', "config.webhookSecret", 'req.is("application/json")',
  'res.status(404)', 'res.status(401)', 'res.status(415)',
]) assert.ok(boundary.includes(contract), `${contract} must remain in the provider-only webhook boundary`);
assert.match(route, /router\.post\("\/webhooks\/telegram\/:adapterId", requireTelegramWebhook/);
assert.match(route, /receiveTelegramWebhook\(req\.body\)/);
assert.match(route, /if \(!receipt\.duplicate\)/);
assert.match(route, /processTelegramInboundQueue\(\)/);
assert.ok(app.includes('"/api/v1/webhooks/telegram"'), "webhook must retain its dedicated rate-limit boundary");

for (const visible of [
  "Connect Telegram", "Conectar Telegram", "Telegram channel linking is not configured",
  "Telegram assistant use requires explicit confirmation", "Privacy: BIMLog stores encrypted Telegram identifiers",
]) assert.ok(profile.includes(visible), `${visible} must remain visible in the user connection journey`);
for (const visible of [
  "Telegram Delivery and Operations", "Entregas y operaciones de Telegram",
  "Prepare preview — does not send", "Preparar vista previa — no envía",
  "Super-admin Telegram operations", "Operaciones de Telegram de superadministrador",
]) assert.ok(operations.includes(visible), `${visible} must remain visible in operational tooling`);
assert.ok(directory.includes('id: "telegram-operations"'), "Telegram operations must remain discoverable in All Tools");
assert.doesNotMatch(`${profile}\n${operations}`, /x-telegram-bot-api-secret-token|webhookSecret/, "provider webhook secrets must never enter the browser UI");

const tsx = path.resolve("artifacts/api-server/node_modules/tsx/dist/cli.mjs");
const evidenceDir = path.resolve(process.env.TEMP || ".", "bimlog-p208-telegram-browser-evidence");
mkdirSync(evidenceDir, { recursive: true });
for (const fixture of [
  "artifacts/api-server/src/lib/telegram-operations-browser.behavior.ts",
  "artifacts/api-server/src/lib/telegram-product-delivery-artifacts.behavior.ts",
  "artifacts/api-server/src/lib/telegram-rfi-notifications.behavior.ts",
]) execFileSync(process.execPath, [tsx, path.resolve(fixture)], {
  stdio: "inherit",
  windowsHide: true,
  cwd: fixture.includes("telegram-operations-browser") ? path.resolve("artifacts/api-server") : process.cwd(),
  env: { ...process.env, TELEGRAM_BROWSER_EVIDENCE_DIR: evidenceDir },
});

console.log("P208 signed Telegram webhook adapter/secret/content-type denial, duplicate-safe durable queue, secret isolation, bilingual connection, operational discovery, and governed delivery gates passed.");
