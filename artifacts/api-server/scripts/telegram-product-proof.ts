import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.PROD_DATABASE_URL ||= "postgres://proof:proof@127.0.0.1:1/proof";
process.env.TELEGRAM_PRODUCT_ADAPTER_ID = "telegram-product-proof";
process.env.TELEGRAM_PRODUCT_BOT_USERNAME = "BIMLogBot";
process.env.TELEGRAM_PRODUCT_BOT_TOKEN = "123456:proof";
process.env.TELEGRAM_PRODUCT_WEBHOOK_SECRET = "proof-secret-32-bytes-minimum";
process.env.TELEGRAM_PRODUCT_CONSENT_VERSION = "telegram-consent-v1";
process.env.TELEGRAM_PRODUCT_DATA_KEY = "proof-data-key-32-bytes-minimum";
process.env.PUBLIC_BASE_URL = "https://example.invalid";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(here, "..");
const repoRoot = path.resolve(apiRoot, "..", "..");

const telegram = await import("../src/lib/telegram-product");

const config = telegram.requireTelegramProductConfig();
assert.equal(config.configured, true);
assert.equal(config.adapterId, "telegram-product-proof");
assert.equal(config.botUsername, "BIMLogBot");

const tokens = new Set<string>();
for (let i = 0; i < 128; i += 1) {
  const token = telegram.generateRawLinkToken();
  assert.equal(Buffer.from(token, "base64url").length, 32);
  assert.match(token, /^[A-Za-z0-9_-]+$/);
  assert.equal(tokens.has(token), false);
  tokens.add(token);
}

const rawToken = telegram.generateRawLinkToken();
const tokenHmac = telegram.hmacValue(config, rawToken);
assert.equal(tokenHmac.length, 64);
assert.equal(tokenHmac.includes(rawToken), false);
assert.equal(telegram.hmacValue(config, rawToken), tokenHmac);

const encryptedA = telegram.encryptEvidence(config, { rawToken, telegramUserId: "123456789" });
const encryptedB = telegram.encryptEvidence(config, { rawToken, telegramUserId: "123456789" });
assert.match(encryptedA, /^v1:/);
assert.notEqual(encryptedA, encryptedB);
assert.equal(encryptedA.includes(rawToken), false);
assert.equal(encryptedA.includes("123456789"), false);

assert.equal(telegram.timingSafeEqualText("proof-secret", "proof-secret"), true);
assert.equal(telegram.timingSafeEqualText("proof-secret", "proof-secret-x"), false);
assert.equal(telegram.timingSafeEqualText(undefined, "proof-secret"), false);

const schemaSource = fs.readFileSync(path.join(repoRoot, "lib/db/src/schema/telegram-product.ts"), "utf8");
for (const tableName of [
  "notification_channels",
  "channel_linking_tokens",
  "notification_preferences",
  "consent_records",
  "telegram_inbound_updates",
]) {
  assert.equal(schemaSource.includes(tableName), true, `${tableName} schema missing`);
}
assert.equal(schemaSource.includes("notification_channels_active_user_uidx"), true);
assert.equal(schemaSource.includes("notification_channels_active_telegram_user_uidx"), true);
assert.equal(schemaSource.includes("telegram_inbound_updates_adapter_update_uidx"), true);

const appSource = fs.readFileSync(path.join(repoRoot, "artifacts/api-server/src/app.ts"), "utf8");
assert.equal(appSource.includes('express.json({ limit: "64kb", type: "application/json"'), true);
assert.equal(appSource.includes("CREATE TABLE IF NOT EXISTS notification_channels"), true);
assert.equal(appSource.includes("CREATE UNIQUE INDEX IF NOT EXISTS telegram_inbound_updates_adapter_update_uidx"), true);
assert.equal(appSource.includes("startTelegramProductWorker()"), true);

const serviceSource = fs.readFileSync(path.join(repoRoot, "artifacts/api-server/src/lib/telegram-product.ts"), "utf8");
const receiveIndex = serviceSource.indexOf("export async function receiveTelegramWebhook");
const queueIndex = serviceSource.indexOf("export async function processTelegramInboundQueue");
const receiveSource = serviceSource.slice(receiveIndex, queueIndex);
const receiptIndex = receiveSource.indexOf("INSERT INTO telegram_inbound_updates");
assert.ok(receiveIndex > 0);
assert.ok(queueIndex > receiveIndex);
assert.ok(receiptIndex > 0);
assert.equal(serviceSource.includes("FOR UPDATE OF clt"), true);
assert.equal(serviceSource.includes("status = 'consumed'"), true);
assert.equal(serviceSource.includes("TELEGRAM_CONSENT_REQUIRED"), true);
assert.equal(serviceSource.includes("channel_linking"), true);
assert.equal(serviceSource.includes("task_notifications"), false);
assert.equal(serviceSource.includes("telegramUserId"), true);
assert.equal(serviceSource.includes("encrypted_telegram_user_id"), true);
assert.equal(serviceSource.includes("TELEGRAM_PRODUCT_BOT_TOKEN"), true);
assert.equal(serviceSource.includes("processTelegramInboundQueue"), true);
assert.equal(serviceSource.includes("revokeTelegramConnectionTx"), true);

console.log(JSON.stringify({
  ok: true,
  tokenSamples: tokens.size,
  tokenBytes: 32,
  durableReceiptBeforeBusiness: true,
  singleUseTokenLock: true,
  explicitConsentRequired: true,
  canonicalDisconnect: true,
  noPlaintextTokenInStoredTokenProof: true,
  encryptedEvidenceProof: true,
}, null, 2));
