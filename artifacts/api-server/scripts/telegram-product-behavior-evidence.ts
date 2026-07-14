import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";

process.env.PROD_DATABASE_URL ||= "postgres://postgres:postgres@127.0.0.1:55432/bimlog_rfi_test";
process.env.JWT_SECRET ||= "telegram-product-local-evidence-secret";
process.env.TELEGRAM_PRODUCT_ADAPTER_ID = `telegram-product-evidence-${Date.now()}`;
process.env.TELEGRAM_PRODUCT_BOT_USERNAME = "BIMLogBot";
process.env.TELEGRAM_PRODUCT_BOT_TOKEN = "123456:local-evidence";
process.env.TELEGRAM_PRODUCT_WEBHOOK_SECRET = "local-evidence-webhook-secret";
process.env.TELEGRAM_PRODUCT_CONSENT_VERSION = "telegram-channel-linking-v1";
process.env.TELEGRAM_PRODUCT_DATA_KEY = "local-evidence-data-key-32-bytes-minimum";
process.env.PUBLIC_BASE_URL = "http://127.0.0.1";

const sentMessages: string[] = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (url.startsWith("https://api.telegram.org/")) {
    const body = init?.body ? JSON.parse(String(init.body)) as { text?: string } : {};
    if (body.text) sentMessages.push(body.text);
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  return originalFetch(input as never, init);
}) as typeof fetch;

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");
const evidenceRoot = process.argv[2] || path.join("C:\\Dev\\bimlog-tools\\evidence\\telegram-product-implementation-1", new Date().toISOString().replace(/[-:]/g, "").slice(0, 15));
fs.mkdirSync(evidenceRoot, { recursive: true });

const [{ pool }, { signToken }, { default: app }, telegram] = await Promise.all([
  import("@workspace/db"),
  import("../src/middlewares/auth"),
  import("../src/app"),
  import("../src/lib/telegram-product"),
]);

async function waitForTelegramTables() {
  for (let i = 0; i < 50; i += 1) {
    try {
      await pool.query("SELECT 1 FROM telegram_inbound_updates LIMIT 1");
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("Telegram migration tables were not ready.");
}

function listen(): Promise<{ server: http.Server; baseUrl: string }> {
  const server = http.createServer(app);
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert.equal(typeof address, "object");
      resolve({ server, baseUrl: `http://127.0.0.1:${address!.port}` });
    });
  });
}

async function api(baseUrl: string, pathName: string, token: string | null, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${baseUrl}/api/v1${pathName}`, { ...init, headers });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  return { status: response.status, json };
}

function authToken(user: { id: number; email: string; company_id: number; full_name: string }) {
  return signToken({
    userId: user.id,
    email: user.email,
    companyId: user.company_id,
    fullName: user.full_name,
    companyName: "Telegram Evidence Co",
  });
}

async function makeUser(label: string) {
  const company = await pool.query<{ id: number }>(
    "INSERT INTO companies (name) VALUES ($1) RETURNING id",
    [`Telegram Evidence Co ${label}`],
  );
  const user = await pool.query<{ id: number; email: string; company_id: number; full_name: string }>(
    "INSERT INTO users (email, password_hash, full_name, company_id) VALUES ($1, 'local-evidence', $2, $3) RETURNING id, email, company_id, full_name",
    [`telegram-${label}-${Date.now()}@example.invalid`, `Telegram ${label}`, company.rows[0].id],
  );
  return user.rows[0];
}

function startTokenFrom(url: string): string {
  const parsed = new URL(url);
  return parsed.searchParams.get("start") || "";
}

async function postWebhook(baseUrl: string, update: unknown, secret = process.env.TELEGRAM_PRODUCT_WEBHOOK_SECRET!, adapter = process.env.TELEGRAM_PRODUCT_ADAPTER_ID!) {
  const response = await fetch(`${baseUrl}/api/v1/webhooks/telegram/${adapter}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-telegram-bot-api-secret-token": secret },
    body: JSON.stringify(update),
  });
  return response.status;
}

async function queue() {
  return telegram.processTelegramInboundQueue(50);
}

async function waitFor<T>(read: () => Promise<T>, ready: (value: T) => boolean, message: string): Promise<T> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const value = await read();
    if (ready(value)) return value;
    await queue();
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(message);
}

await waitForTelegramTables();
const { server, baseUrl } = await listen();
const results: Record<string, unknown> = {};
try {
  const config = telegram.requireTelegramProductConfig();
  const userA = await makeUser("a");
  const userB = await makeUser("b");
  const tokenA = authToken(userA);
  const tokenB = authToken(userB);

  const missingConsent = await api(baseUrl, "/integrations/telegram/link", tokenA, { method: "POST", body: JSON.stringify({}) });
  assert.equal(missingConsent.status, 400);
  results.explicitConsentRequired = missingConsent.json.code;

  const staleConsent = await api(baseUrl, "/integrations/telegram/link", tokenA, { method: "POST", body: JSON.stringify({ consentAccepted: true, consentVersion: "old", purpose: "channel_linking" }) });
  assert.equal(staleConsent.status, 400);
  results.staleConsentRejected = staleConsent.json.code;

  const link = await api(baseUrl, "/integrations/telegram/link", tokenA, { method: "POST", body: JSON.stringify({ consentAccepted: true, consentVersion: config.consentVersion, purpose: "channel_linking" }) });
  assert.equal(link.status, 200);
  const rawToken = startTokenFrom(link.json.url);
  assert.equal(Buffer.from(rawToken, "base64url").length, 32);
  const expiresAt = new Date(link.json.expiresAt).getTime();
  assert.ok(expiresAt - Date.now() > 9 * 60 * 1000 && expiresAt - Date.now() <= 10 * 60 * 1000);
  results.tenMinuteExpiration = link.json.expiresAt;

  const tokenRows = await pool.query<{ token_hmac: string; consent_version: string; consent_purpose: string }>(
    "SELECT token_hmac, consent_version, consent_purpose FROM channel_linking_tokens WHERE adapter_id = $1 AND user_id = $2",
    [config.adapterId, userA.id],
  );
  assert.equal(tokenRows.rows.some((r) => r.token_hmac.includes(rawToken)), false);
  assert.equal(tokenRows.rows[0].consent_version, config.consentVersion);
  assert.equal(tokenRows.rows[0].consent_purpose, "channel_linking");
  results.rawTokenAbsentFromDatabase = true;

  assert.equal(await postWebhook(baseUrl, { update_id: 100, message: { text: `/start ${rawToken}`, chat: { id: 7001, type: "private" }, from: { id: 9001, username: "evidence_a" } } }), 200);
  await queue();
  assert.equal(await postWebhook(baseUrl, { update_id: 101, message: { text: `/start ${rawToken}`, chat: { id: 7001, type: "private" }, from: { id: 9001, username: "evidence_a" } } }), 200);
  await queue();
  const consumed = await pool.query<{ consumed: string; connected: string }>(
    "SELECT count(*) FILTER (WHERE clt.status = 'consumed')::text AS consumed, (SELECT count(*)::text FROM notification_channels WHERE adapter_id = $1 AND user_id = $2 AND status = 'connected') AS connected FROM channel_linking_tokens clt WHERE clt.adapter_id = $1 AND clt.user_id = $2",
    [config.adapterId, userA.id],
  );
  assert.equal(consumed.rows[0].consumed, "1");
  assert.equal(consumed.rows[0].connected, "1");
  results.singleUseConsumption = true;

  assert.equal(await postWebhook(baseUrl, { update_id: 200, message: { text: "/help", chat: { id: 7001, type: "private" }, from: { id: 9001 } } }), 200);
  assert.equal(await postWebhook(baseUrl, { update_id: 200, message: { text: "/help", chat: { id: 7001, type: "private" }, from: { id: 9001 } } }), 200);
  await queue();
  const replay = await pool.query<{ n: string }>("SELECT count(*)::text AS n FROM telegram_inbound_updates WHERE adapter_id = $1 AND update_id = '200'", [config.adapterId]);
  assert.equal(replay.rows[0].n, "1");
  results.duplicateUpdateSafe = true;

  assert.equal(await postWebhook(baseUrl, { update_id: 201 }, config.webhookSecret, "wrong-adapter"), 404);
  assert.equal(await postWebhook(baseUrl, { update_id: 202 }, "wrong-secret"), 401);
  results.wrongAdapterAndSecretRejected = true;

  assert.equal(await postWebhook(baseUrl, { update_id: 203, message: { text: "/help", chat: { id: -100, type: "group" }, from: { id: 9001 } } }), 200);
  await queue();
  const nonPrivate = await pool.query<{ status: string; error_code: string }>("SELECT status, error_code FROM telegram_inbound_updates WHERE adapter_id = $1 AND update_id = '203'", [config.adapterId]);
  assert.deepEqual(nonPrivate.rows[0], { status: "rejected", error_code: "NON_PRIVATE_CHAT" });
  results.nonPrivateChatRejected = true;

  const linkB = await api(baseUrl, "/integrations/telegram/link", tokenB, { method: "POST", body: JSON.stringify({ consentAccepted: true, consentVersion: config.consentVersion, purpose: "channel_linking" }) });
  const rawTokenB = startTokenFrom(linkB.json.url);
  await Promise.all([
    postWebhook(baseUrl, { update_id: 300, message: { text: `/start ${rawTokenB}`, chat: { id: 7002, type: "private" }, from: { id: 9002 } } }),
    postWebhook(baseUrl, { update_id: 301, message: { text: `/start ${rawTokenB}`, chat: { id: 7002, type: "private" }, from: { id: 9002 } } }),
  ]);
  await Promise.all([queue(), queue()]);
  const concurrent = await waitFor(
    () => pool.query<{ consumed: string; connected: string }>(
      "SELECT count(*) FILTER (WHERE status = 'consumed')::text AS consumed, (SELECT count(*)::text FROM notification_channels WHERE adapter_id = $1 AND user_id = $2 AND status = 'connected') AS connected FROM channel_linking_tokens WHERE adapter_id = $1 AND user_id = $2",
      [config.adapterId, userB.id],
    ),
    (result) => result.rows[0]?.consumed === "1" && result.rows[0]?.connected === "1",
    "Concurrent token consumption did not reach its durable final state.",
  );
  assert.equal(concurrent.rows[0].consumed, "1");
  assert.equal(concurrent.rows[0].connected, "1");
  results.concurrentConsumptionOneWinner = true;

  const conflictUser = await makeUser("conflict");
  const conflictJwt = authToken(conflictUser);
  const conflictLink = await api(baseUrl, "/integrations/telegram/link", conflictJwt, { method: "POST", body: JSON.stringify({ consentAccepted: true, consentVersion: config.consentVersion, purpose: "channel_linking" }) });
  await postWebhook(baseUrl, { update_id: 400, message: { text: `/start ${startTokenFrom(conflictLink.json.url)}`, chat: { id: 7001, type: "private" }, from: { id: 9001 } } });
  await queue();
  const conflict = await pool.query<{ user_id: number }>("SELECT user_id FROM notification_channels WHERE adapter_id = $1 AND telegram_user_hash = $2 AND status = 'connected'", [config.adapterId, telegram.hmacValue(config, "telegram-user:9001")]);
  assert.equal(conflict.rows[0].user_id, userA.id);
  results.identityConflictNotReassigned = true;

  const browserDisconnect = await api(baseUrl, "/integrations/telegram", tokenB, { method: "DELETE" });
  assert.equal(browserDisconnect.status, 200);
  assert.equal(browserDisconnect.json.status, "revoked");
  const pendingAfterBrowserDisconnect = await pool.query<{ pending: string; enabled: string; topics: unknown }>(
    "SELECT (SELECT count(*)::text FROM channel_linking_tokens WHERE adapter_id = $1 AND user_id = $2 AND status = 'pending') AS pending, enabled, topics FROM notification_preferences WHERE adapter_id = $1 AND user_id = $2",
    [config.adapterId, userB.id],
  );
  assert.equal(pendingAfterBrowserDisconnect.rows[0].pending, "0");
  assert.equal(pendingAfterBrowserDisconnect.rows[0].enabled, "false");
  assert.deepEqual(pendingAfterBrowserDisconnect.rows[0].topics, {});
  results.browserDisconnectFinalState = browserDisconnect.json.status;

  const reconnect = await api(baseUrl, "/integrations/telegram/link", tokenB, { method: "POST", body: JSON.stringify({ consentAccepted: true, consentVersion: config.consentVersion, purpose: "channel_linking" }) });
  await postWebhook(baseUrl, { update_id: 500, message: { text: `/start ${startTokenFrom(reconnect.json.url)}`, chat: { id: 7002, type: "private" }, from: { id: 9002 } } });
  await queue();
  await postWebhook(baseUrl, { update_id: 501, message: { text: "/disconnect", chat: { id: 7002, type: "private" }, from: { id: 9002 } } });
  await queue();
  const telegramDisconnect = await api(baseUrl, "/integrations/telegram/status", tokenB);
  assert.equal(telegramDisconnect.json.status, "revoked");
  results.telegramDisconnectFinalState = telegramDisconnect.json.status;

  const recoveryLink = await api(baseUrl, "/integrations/telegram/link", tokenB, { method: "POST", body: JSON.stringify({ consentAccepted: true, consentVersion: config.consentVersion, purpose: "channel_linking" }) });
  const recoveryToken = startTokenFrom(recoveryLink.json.url);
  const recoveryEvidence = telegram.encryptEvidence(config, {
    updateId: "600",
    kind: "message",
    command: "/start",
    argument: recoveryToken,
    chatType: "private",
    telegramUserId: "9600",
    telegramChatId: "7600",
    memberStatus: null,
  });
  await pool.query(
    "INSERT INTO telegram_inbound_updates (adapter_id, update_id, status, telegram_user_hash, telegram_chat_hash, command, encrypted_evidence) VALUES ($1, '600', 'received', $2, $3, '/start', $4)",
    [config.adapterId, telegram.hmacValue(config, "telegram-user:9600"), telegram.hmacValue(config, "telegram-chat:7600"), recoveryEvidence],
  );
  await queue();
  await queue();
  const recovery = await pool.query<{ n: string; status: string }>("SELECT count(*)::text AS n, max(status) AS status FROM telegram_inbound_updates WHERE adapter_id = $1 AND update_id = '600'", [config.adapterId]);
  assert.equal(recovery.rows[0].n, "1");
  assert.equal(recovery.rows[0].status, "processed");
  results.restartRecoveryProcessesOnce = true;

  await postWebhook(baseUrl, { update_id: 700, message: { text: "/language es", chat: { id: 7600, type: "private" }, from: { id: 9600 } } });
  await postWebhook(baseUrl, { update_id: 701, message: { text: "/settings", chat: { id: 7600, type: "private" }, from: { id: 9600 } } });
  await queue();
  const localizedMessages = await waitFor(
    async () => [...sentMessages],
    (messages) => messages.some((m) => m.includes("Español")) && messages.some((m) => m.includes("inglés") || m.includes("conexión") || m.includes("está")),
    "Spanish Telegram responses were not delivered after durable queue processing.",
  );
  assert.ok(localizedMessages.some((m) => m.includes("Español")));
  assert.ok(localizedMessages.some((m) => m.includes("inglés") || m.includes("conexión") || m.includes("está")));
  results.utf8TelegramResponses = true;

  const statusResponse = await api(baseUrl, "/integrations/telegram/status", tokenA);
  const serializedStatus = JSON.stringify(statusResponse.json);
  assert.equal(/telegram(User|Chat)|webhook|secret|botToken|dataKey|9001|7001/i.test(serializedStatus), false);
  results.browserStatusLeaksNoTelegramIdsOrSecrets = true;

  const preferenceRows = await pool.query<{ enabled: string; topics: unknown }>("SELECT enabled, topics FROM notification_preferences WHERE adapter_id = $1", [config.adapterId]);
  assert.ok(preferenceRows.rows.every((r) => r.enabled === "false"));
  assert.ok(preferenceRows.rows.every((r) => JSON.stringify(r.topics) === "{}"));
  results.noRfiSubmittalTopicsEnabled = true;

  const profileSource = fs.readFileSync(path.join(repoRoot, "artifacts/bimlog/src/pages/Profile.tsx"), "utf8");
  const serviceSource = fs.readFileSync(path.join(repoRoot, "artifacts/api-server/src/lib/telegram-product.ts"), "utf8");
  const localizedSource = `${profileSource}\n${serviceSource}`.toLocaleLowerCase("es");
  for (const word of ["Español", "inglés", "conexión", "configuración", "notificaciones", "privacidad", "Desconectar", "está"]) {
    assert.ok(localizedSource.includes(word.toLocaleLowerCase("es")), `missing UTF-8 word ${word}`);
  }
  assert.equal(/espanol|ingles|estan|task_notifications/.test(`${profileSource}\n${serviceSource}`), false);
  results.unicodeCodePointCheck = true;

  fs.writeFileSync(path.join(evidenceRoot, "behavior-results.json"), JSON.stringify({ ok: true, adapterId: config.adapterId, results, sentMessageCount: sentMessages.length }, null, 2));
  console.log(JSON.stringify({ ok: true, evidenceRoot, results }, null, 2));
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await Promise.race([
    pool.end(),
    new Promise<void>((resolve) => setTimeout(resolve, 1_000)),
  ]);
  globalThis.fetch = originalFetch;
}

process.exit(0);
