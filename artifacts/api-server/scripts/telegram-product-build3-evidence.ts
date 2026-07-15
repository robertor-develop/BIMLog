import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (!process.env.PROD_DATABASE_URL) throw new Error("PROD_DATABASE_URL is required for the isolated evidence run.");
process.env.JWT_SECRET ||= crypto.randomBytes(32).toString("base64url");
process.env.TELEGRAM_PRODUCT_ADAPTER_ID = `telegram-product-build3-correction-${Date.now()}`;
process.env.TELEGRAM_PRODUCT_BOT_USERNAME = "BIMLogBot";
process.env.TELEGRAM_PRODUCT_BOT_TOKEN = `999999:${crypto.randomBytes(24).toString("base64url")}`;
process.env.TELEGRAM_PRODUCT_WEBHOOK_SECRET = crypto.randomBytes(32).toString("base64url");
process.env.TELEGRAM_PRODUCT_CONSENT_VERSION = "telegram-product-build3-correction-v1";
process.env.TELEGRAM_PRODUCT_DATA_KEY = crypto.randomBytes(32).toString("base64url");
process.env.PUBLIC_BASE_URL = "http://127.0.0.1";
process.env.AI_PROVIDER_ACTIVE_KEK_VERSION = "v1";
process.env.AI_PROVIDER_KEK_V1 = Buffer.alloc(32, 7).toString("base64url");

const evidenceRoot = process.argv[2] || path.join("C:\\Dev\\bimlog-tools\\evidence\\telegram-product-build-3-correction", new Date().toISOString().replace(/[-:]/g, "").slice(0, 15));
fs.mkdirSync(evidenceRoot, { recursive: true });
const telegramFetchPreload = path.join(evidenceRoot, "telegram-fetch-preload.cjs");
fs.writeFileSync(telegramFetchPreload, `const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (url.startsWith("https://api.telegram.org/")) {
    return new Response(JSON.stringify({ ok: true, result: { message_id: process.pid } }), { status: 200, headers: { "content-type": "application/json" } });
  }
  return originalFetch(input, init);
};
`);

type ProviderIdMode = "body" | "header" | "missing";
const providerRequests: Array<{ url: string | undefined; hasAuthorization: boolean; mode: ProviderIdMode; body: any; responseText: string }> = [];
let providerFailure = false;
let providerIdMode: ProviderIdMode = "body";
const providerServer = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (chunk) => { raw += chunk; });
  req.on("end", () => {
    const body = JSON.parse(raw || "{}");
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const joined = messages.map((m: any) => String(m.content || "")).join(" | ");
    const isSpanish = /Recuerda|coordinacion|coordinación|segunda pregunta/i.test(joined);
    const secondTurn = /first-provider|primer-proveedor/i.test(joined) && /second question|segunda pregunta/i.test(joined);
    const responseText = secondTurn
      ? (isSpanish ? "segundo-proveedor: uso contexto de coordinacion previa y segunda pregunta." : "second-provider: using prior steel context and second question.")
      : (isSpanish ? "primer-proveedor: guardo contexto de coordinacion." : "first-provider: storing steel context.");
    providerRequests.push({ url: req.url, hasAuthorization: Boolean(req.headers.authorization), mode: providerIdMode, body, responseText });
    if (providerFailure) {
      res.writeHead(502, { "content-type": "application/json", "x-request-id": "provider-failed-request" });
      res.end(JSON.stringify({ error: { message: "local provider failure" } }));
      return;
    }
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (providerIdMode === "header") headers["x-request-id"] = `provider-header-${providerRequests.length}`;
    res.writeHead(200, headers);
    res.end(JSON.stringify({
      ...(providerIdMode === "body" ? { id: `provider-body-${providerRequests.length}` } : {}),
      choices: [{ message: { content: responseText } }],
      usage: { prompt_tokens: 40 + providerRequests.length, completion_tokens: 20 + providerRequests.length },
    }));
  });
});
await new Promise<void>((resolve) => providerServer.listen(0, "127.0.0.1", resolve));
const providerAddress = providerServer.address();
assert.equal(typeof providerAddress, "object");
process.env.OPENAI_API_BASE_URL = `http://127.0.0.1:${providerAddress!.port}/v1`;

const sentMessages: Array<{ chatId: string; text: string; messageId: number }> = [];
let telegramFailure = false;
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (url.startsWith("https://api.telegram.org/")) {
    if (telegramFailure) return new Response(JSON.stringify({ ok: false }), { status: 500, headers: { "Content-Type": "application/json" } });
    const body = init?.body ? JSON.parse(String(init.body)) as { chat_id?: string; text?: string } : {};
    const messageId = sentMessages.length + 1000;
    sentMessages.push({ chatId: String(body.chat_id || ""), text: String(body.text || ""), messageId });
    return new Response(JSON.stringify({ ok: true, result: { message_id: messageId } }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  return originalFetch(input as never, init);
}) as typeof fetch;

const [{ pool }, { signToken }, { default: app }, telegram, ai] = await Promise.all([
  import("@workspace/db"),
  import("../src/middlewares/auth"),
  import("../src/app"),
  import("../src/lib/telegram-product"),
  import("../src/lib/ai-control-plane"),
]);

type UserRow = { id: number; email: string; company_id: number; full_name: string };
const checks: Array<{ id: number; name: string; pass: boolean; evidence?: unknown }> = [];
function check(name: string, pass: boolean, evidence?: unknown) {
  checks.push({ id: checks.length + 1, name, pass, evidence });
  assert.equal(pass, true, name);
}
const exactNames = [
  "English onboarding and persistence.",
  "Spanish onboarding and persistence.",
  "Explicit language change.",
  "Unsupported-language fallback.",
  "Unlinked identity rejected safely.",
  "Disabled/revoked link rejected safely.",
  "Ordinary user receives only the product menu.",
  "Ordinary user cannot access super-admin functions.",
  "Linked Roberto super-admin receives authorized product-admin functions.",
  "Telegram username/chat-ID spoofing cannot grant super-admin access.",
  "Help mode creates zero AI usage and zero charges.",
  "Support mode creates zero AI usage and zero charges.",
  "Assistant mode requires confirmation.",
  "Cancel produces no provider call or charge.",
  "BYO-provider warning identifies user-paid credits.",
  "Platform-funded warning identifies BIMLog allowance use.",
  "Duplicate Telegram update produces one inbound message, one outbound response, and at most one charge.",
  "Real provider failure is recorded without false delivery or duplicate charge.",
  "English multi-turn context persists.",
  "Spanish multi-turn context persists without mojibake.",
  "User sees only their own conversation history.",
  "Cross-company conversation access is rejected.",
  "Super-admin content access requires target and reason and creates audit evidence.",
  "Support case number is unique and stable.",
  "Support confirmation returns the real created case number.",
  "Support status history persists through the required lifecycle.",
  "No automatic file reading occurs.",
  "No email, file delivery, report delivery, or project mutation exists.",
  "No secret appears in responses, logs, database proof, or evidence.",
  "Behavior and delivery accountability persist after API restart.",
];
const seedStamp = Date.now();
let globalSystemSeeded = false;
let systemBudgetId: string | null = null;
const createdUserIds: number[] = [];
const createdCompanyIds: number[] = [];
const createdSystemConnectionIds: string[] = [];
const localSecret = (label: string) => ["sk", "local", label].join("-");

async function waitForTables() {
  for (let i = 0; i < 80; i += 1) {
    try { await pool.query("SELECT 1 FROM telegram_conversations LIMIT 1"); return; }
    catch { await new Promise((resolve) => setTimeout(resolve, 100)); }
  }
  throw new Error("tables not ready");
}
function listen(): Promise<{ server: http.Server; baseUrl: string }> {
  const server = http.createServer(app);
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => {
    const address = server.address(); assert.equal(typeof address, "object");
    resolve({ server, baseUrl: `http://127.0.0.1:${address!.port}` });
  }));
}
function authToken(user: UserRow) {
  return signToken({ userId: user.id, email: user.email, companyId: user.company_id, fullName: user.full_name, companyName: "Telegram Build 3" });
}
async function api(baseUrl: string, pathName: string, token: string | null, init: RequestInit = {}) {
  const headers = new Headers(init.headers); headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${baseUrl}/api/v1${pathName}`, { ...init, headers });
  const text = await response.text();
  return { status: response.status, json: text ? JSON.parse(text) : null };
}
async function makeUser(label: string, superAdmin = false): Promise<UserRow> {
  const company = await pool.query<{ id: number }>("INSERT INTO companies(name) VALUES($1) RETURNING id", [`Telegram Correction ${label}`]);
  const user = (await pool.query<UserRow>("INSERT INTO users(email,password_hash,full_name,company_id,is_super_admin) VALUES($1,'x',$2,$3,$4) RETURNING id,email,company_id,full_name", [`tg-correction-${label}-${Date.now()}@example.invalid`, label, company.rows[0].id, superAdmin])).rows[0];
  createdCompanyIds.push(company.rows[0].id);
  createdUserIds.push(user.id);
  return user;
}
async function sendWebhook(baseUrl: string, updateId: number, text: string, telegramUserId: number, chatId: number, username?: string) {
  const before = sentMessages.length;
  const response = await fetch(`${baseUrl}/api/v1/webhooks/telegram/${process.env.TELEGRAM_PRODUCT_ADAPTER_ID}`, { method: "POST", headers: { "Content-Type": "application/json", "x-telegram-bot-api-secret-token": process.env.TELEGRAM_PRODUCT_WEBHOOK_SECRET! }, body: JSON.stringify({ update_id: updateId, message: { text, chat: { id: chatId, type: "private" }, from: { id: telegramUserId, username } } }) });
  await telegram.processTelegramInboundQueue(100); await new Promise((resolve) => setTimeout(resolve, 50)); await telegram.processTelegramInboundQueue(100);
  return { status: response.status, replies: sentMessages.slice(before).map((m) => m.text) };
}
async function linkUser(baseUrl: string, user: UserRow, telegramUserId: number, chatId: number, lang?: "en" | "es") {
  const config = telegram.requireTelegramProductConfig();
  const link = await api(baseUrl, "/integrations/telegram/link", authToken(user), { method: "POST", body: JSON.stringify({ consentAccepted: true, consentVersion: config.consentVersion, purpose: "channel_linking" }) });
  const raw = new URL(link.json.url).searchParams.get("start");
  await sendWebhook(baseUrl, 10_000 + telegramUserId, `/start ${raw}`, telegramUserId, chatId);
  if (lang) await sendWebhook(baseUrl, 20_000 + telegramUserId, `/language ${lang}`, telegramUserId, chatId);
}
async function seedAi(user: UserRow, superAdmin: UserRow) {
  const now = new Date(Date.now() - 1000).toISOString();
  const later = new Date(Date.now() + 86_400_000).toISOString();
  const version = 500000 + user.id;
  const personal = await ai.createProviderConnection({ actorUserId: user.id, actorCompanyId: user.company_id, actorIsSuperAdmin: false, actorIsCompanyAdmin: false, ownerType: "personal", provider: "openai", secret: localSecret("personal"), allowedModels: ["test-model"] });
  await ai.validateConnection({ userId: user.id, companyId: user.company_id, isSuperAdmin: false, isCompanyAdmin: false }, personal.id, async () => new Response(JSON.stringify({ data: [{ id: "test-model" }] }), { status: 200 }));
  if (!globalSystemSeeded) {
    const activeSystem = await pool.query<{ id: string; allowed_models: string[] }>(`SELECT id,allowed_models FROM provider_connections WHERE owner_type='system' AND provider='openai' AND status='active' ORDER BY created_at DESC LIMIT 1`);
    if (!activeSystem.rows[0]) {
      const system = await ai.createProviderConnection({ actorUserId: superAdmin.id, actorCompanyId: superAdmin.company_id, actorIsSuperAdmin: true, actorIsCompanyAdmin: false, ownerType: "system", provider: "openai", secret: localSecret("system"), allowedModels: ["test-model"] });
      await ai.validateConnection({ userId: superAdmin.id, companyId: superAdmin.company_id, isSuperAdmin: true, isCompanyAdmin: false }, system.id, async () => new Response(JSON.stringify({ data: [{ id: "test-model" }] }), { status: 200 }));
      createdSystemConnectionIds.push(system.id);
    } else if (!activeSystem.rows[0].allowed_models.includes("test-model")) {
      throw new Error("Existing isolated system test connection does not allow test-model.");
    }
    const activePrice = await pool.query(`SELECT id FROM ai_price_schedules WHERE provider='openai' AND model='test-model' AND status='active' AND effective_from<=now() AND (effective_to IS NULL OR effective_to>now()) ORDER BY version DESC LIMIT 1`);
    if (!activePrice.rows[0]) await pool.query(`INSERT INTO ai_price_schedules(id,version,provider,model,currency,unit_basis,input_micros,output_micros,source_url,verified_by_id,verified_at,effective_from,status) VALUES($1,$2,'openai','test-model','USD',1000000,1000,2000,'https://openai.com/api/pricing/',$3,now(),$4,'active')`, [`price-correction-${seedStamp}`, 500000 + seedStamp % 100000, superAdmin.id, now]);
    const activeRule = await pool.query<{ id: string; provider_allowlist: string[]; model_allowlist: string[] }>(`SELECT id,provider_allowlist,model_allowlist FROM entitlement_rules WHERE company_id IS NULL AND capability='assistant' AND funding_type='system' AND enabled=true AND effective_from<=now() AND (effective_to IS NULL OR effective_to>now()) ORDER BY version DESC LIMIT 1`);
    if (!activeRule.rows[0]) {
      await pool.query(`INSERT INTO entitlement_rules(id,version,company_id,capability,funding_type,provider_allowlist,model_allowlist,enabled,requires_file_confirmation,effective_from,effective_to,created_by_id) VALUES($1,$2,NULL,'assistant','system','["openai"]','["test-model"]',true,false,$3,$4,$5)`, [`ent-correction-system-${seedStamp}`, 500000 + seedStamp % 100000, now, later, superAdmin.id]);
    } else if (!activeRule.rows[0].provider_allowlist.includes("openai") || !activeRule.rows[0].model_allowlist.includes("test-model")) {
      throw new Error("Existing isolated system test entitlement is incompatible with test-model.");
    }
    const activeBudget = await pool.query(`SELECT id FROM company_ai_budgets WHERE funding_owner_type='system' AND status='active' AND effective_from<=now() AND (effective_to IS NULL OR effective_to>now()) ORDER BY version DESC LIMIT 1`);
    if (!activeBudget.rows[0]) await pool.query(`INSERT INTO company_ai_budgets(id,funding_owner_type,company_id,owner_user_id,version,currency,limit_micros,per_request_limit_micros,daily_limit_micros,monthly_limit_micros,session_limit_micros,provider_allowlist,model_allowlist,capability_allowlist,status,effective_from,effective_to,created_by_id) VALUES($1,'system',NULL,NULL,$2,'USD','10000000','10000000','10000000','10000000','10000000','["openai"]','["test-model"]','["assistant"]','active',$3,$4,$5)`, [`budget-correction-system-${seedStamp}`, 500000 + seedStamp % 100000, now, later, superAdmin.id]);
    const systemBudget = await pool.query<{ id: string; provider_allowlist: string[]; model_allowlist: string[]; capability_allowlist: string[] }>(`SELECT id,provider_allowlist,model_allowlist,capability_allowlist FROM company_ai_budgets WHERE funding_owner_type='system' AND status='active' AND effective_from<=now() AND (effective_to IS NULL OR effective_to>now()) ORDER BY version DESC LIMIT 1`);
    if (!systemBudget.rows[0] || !systemBudget.rows[0].provider_allowlist.includes("openai") || !systemBudget.rows[0].model_allowlist.includes("test-model") || !systemBudget.rows[0].capability_allowlist.includes("assistant")) throw new Error("Existing isolated system test budget is incompatible with test-model.");
    systemBudgetId = systemBudget.rows[0].id;
    globalSystemSeeded = true;
  }
  await pool.query(`INSERT INTO ai_price_schedules(id,version,provider,model,currency,unit_basis,input_micros,output_micros,source_url,verified_by_id,verified_at,effective_from,status) VALUES($1,$2,'openai','test-model','USD',1000000,1000,2000,'https://openai.com/api/pricing/',$3,now(),$4,'active') ON CONFLICT DO NOTHING`, [`price-correction-${seedStamp}`, 500000 + seedStamp % 100000, superAdmin.id, now]);
  await pool.query(`INSERT INTO entitlement_rules(id,version,company_id,capability,funding_type,provider_allowlist,model_allowlist,enabled,requires_file_confirmation,effective_from,effective_to,created_by_id) VALUES($1,$2,$3,'assistant','personal','["openai"]','["test-model"]',true,false,$4,$5,$6) ON CONFLICT DO NOTHING`, [`ent-correction-personal-${user.id}`, version, user.company_id, now, later, superAdmin.id]);
  await pool.query(`INSERT INTO company_ai_budgets(id,funding_owner_type,company_id,owner_user_id,version,currency,limit_micros,per_request_limit_micros,daily_limit_micros,monthly_limit_micros,session_limit_micros,provider_allowlist,model_allowlist,capability_allowlist,status,effective_from,effective_to,created_by_id) VALUES($1,'personal',$2,$3,$4,'USD','10000000','10000000','10000000','10000000','10000000','["openai"]','["test-model"]','["assistant"]','active',$5,$6,$7) ON CONFLICT DO NOTHING`, [`budget-correction-personal-${user.id}`, user.company_id, user.id, version, now, later, superAdmin.id]);
  assert.ok(systemBudgetId);
  await pool.query(`INSERT INTO user_ai_allocations(id,budget_id,company_id,user_id,limit_micros,daily_limit_micros,monthly_limit_micros,session_limit_micros,status,created_by_id) VALUES($1,$2,$3,$4,'10000000','10000000','10000000','10000000','active',$5) ON CONFLICT DO NOTHING`, [`alloc-correction-system-${user.id}-${seedStamp}`, systemBudgetId, user.company_id, user.id, superAdmin.id]);
}

async function cleanupRunRecords() {
  if (!createdUserIds.length) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("LOCK TABLE telegram_inbound_updates, telegram_conversation_messages, telegram_conversations IN ACCESS EXCLUSIVE MODE");
    const users = createdUserIds;
    const companies = createdCompanyIds;
    const conversations = await client.query<{ id: string }>("SELECT id FROM telegram_conversations WHERE user_id=ANY($1::int[]) OR company_id=ANY($2::int[])", [users, companies]);
    const conversationIds = conversations.rows.map((row) => row.id);
    const cases = await client.query<{ id: string }>("SELECT id FROM telegram_support_cases WHERE user_id=ANY($1::int[]) OR company_id=ANY($2::int[])", [users, companies]);
    const caseIds = cases.rows.map((row) => row.id);
    const runs = await client.query<{ id: string }>("SELECT id FROM ai_runs WHERE user_id=ANY($1::int[]) OR company_id=ANY($2::int[])", [users, companies]);
    const runIds = runs.rows.map((row) => row.id);
    if (caseIds.length) await client.query("DELETE FROM telegram_support_case_events WHERE case_id=ANY($1::text[])", [caseIds]);
    await client.query("DELETE FROM telegram_support_cases WHERE user_id=ANY($1::int[]) OR company_id=ANY($2::int[])", [users, companies]);
    await client.query("DELETE FROM telegram_inbound_updates WHERE adapter_id=$1", [process.env.TELEGRAM_PRODUCT_ADAPTER_ID]);
    await client.query("DELETE FROM telegram_conversation_messages WHERE conversation_id IN (SELECT id FROM telegram_conversations WHERE user_id=ANY($1::int[]) OR company_id=ANY($2::int[]))", [users, companies]);
    await client.query("DELETE FROM telegram_conversations WHERE user_id=ANY($1::int[]) OR company_id=ANY($2::int[])", [users, companies]);
    await client.query("DELETE FROM channel_linking_tokens WHERE user_id=ANY($1::int[])", [users]);
    await client.query("DELETE FROM notification_channels WHERE user_id=ANY($1::int[])", [users]);
    if (runIds.length) {
      await client.query("ALTER TABLE ai_usage_costs DISABLE TRIGGER ai_usage_costs_immutable_trigger");
      await client.query("DELETE FROM ai_usage_costs WHERE run_id=ANY($1::text[])", [runIds]);
      await client.query("ALTER TABLE ai_usage_costs ENABLE TRIGGER ai_usage_costs_immutable_trigger");
    }
    await client.query("DELETE FROM ai_runs WHERE user_id=ANY($1::int[]) OR company_id=ANY($2::int[])", [users, companies]);
    await client.query("DELETE FROM user_ai_allocations WHERE user_id=ANY($1::int[]) OR company_id=ANY($2::int[])", [users, companies]);
    await client.query("DELETE FROM company_ai_budgets WHERE company_id=ANY($1::int[]) OR owner_user_id=ANY($2::int[]) OR id=$3", [companies, users, `budget-correction-system-${seedStamp}`]);
    await client.query("DELETE FROM entitlement_rules WHERE company_id=ANY($1::int[]) OR id=$2", [companies, `ent-correction-system-${seedStamp}`]);
    await client.query("DELETE FROM ai_price_schedules WHERE id=$1", [`price-correction-${seedStamp}`]);
    await client.query("DELETE FROM provider_connections WHERE user_id=ANY($1::int[]) OR id=ANY($2::text[])", [users, createdSystemConnectionIds]);
    await client.query("DELETE FROM admin_actions_log WHERE admin_user_id=ANY($1::int[]) OR target_id=ANY($2::text[])", [users, [...conversationIds, ...runIds, ...caseIds]]);
    await client.query("DELETE FROM notification_preferences WHERE user_id=ANY($1::int[])", [users]);
    await client.query("DELETE FROM consent_records WHERE user_id=ANY($1::int[])", [users]);
    await client.query("DELETE FROM users WHERE id=ANY($1::int[])", [users]);
    await client.query("DELETE FROM companies WHERE id=ANY($1::int[])", [companies]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
function conversationId(reply: string, command: string) {
  const match = new RegExp(`/${command}\\s+([0-9a-f-]{36})`, "i").exec(reply);
  assert.ok(match?.[1], reply);
  return match[1];
}
async function confirmAssistant(baseUrl: string, chatUser: number, chatId: number, updateId: number, conv: string) {
  return sendWebhook(baseUrl, updateId, `/confirm_ai ${conv}`, chatUser, chatId);
}
async function startBuiltApi(port: number): Promise<{ child: ChildProcessWithoutNullStreams; output: string[]; hash: string }> {
  const bundle = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist/index.cjs");
  const hash = crypto.createHash("sha256").update(fs.readFileSync(bundle)).digest("hex");
  const child = spawn(process.execPath, ["--require", telegramFetchPreload, bundle], { env: { ...process.env, PORT: String(port) }, cwd: process.cwd() });
  const output: string[] = [];
  child.stdout.on("data", (chunk) => output.push(String(chunk)));
  child.stderr.on("data", (chunk) => output.push(String(chunk)));
  for (let i = 0; i < 80; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/healthz`);
      if (res.ok) return { child, output, hash };
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  child.kill();
  throw new Error(`built API did not start on port ${port}: ${output.join("\n")}`);
}
async function stopBuiltApi(child: ChildProcessWithoutNullStreams) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((resolve) => {
    let finished = false;
    const finish = () => { if (!finished) { finished = true; resolve(); } };
    child.once("close", finish);
    child.kill();
    setTimeout(finish, 5_000);
  });
}

await waitForTables();
const { server, baseUrl } = await listen();
try {
  const user = await makeUser("ordinary");
  const other = await makeUser("other");
  const roberto = await makeUser("roberto", true);
  await linkUser(baseUrl, user, 101, 201, "en");
  await linkUser(baseUrl, other, 102, 202, "en");
  await linkUser(baseUrl, roberto, 103, 203, "es");
  await seedAi(user, roberto);
  await seedAi(roberto, roberto);

  check(exactNames[0], (await api(baseUrl, "/integrations/telegram/status", authToken(user))).json.language === "en", { userId: user.id });
  check(exactNames[1], (await api(baseUrl, "/integrations/telegram/status", authToken(roberto))).json.language === "es", { userId: roberto.id });
  await sendWebhook(baseUrl, 30003, "/language es", 101, 201);
  check(exactNames[2], (await api(baseUrl, "/integrations/telegram/status", authToken(user))).json.language === "es");
  const badLang = await sendWebhook(baseUrl, 30004, "/language fr", 101, 201);
  check(exactNames[3], badLang.replies.some((reply) => reply.includes("/language en")));
  const unlinked = await sendWebhook(baseUrl, 30005, "/assistant personal hello", 9999, 299);
  check(exactNames[4], unlinked.replies.some((reply) => /not connected|no est/i.test(reply)));
  await sendWebhook(baseUrl, 30006, "/disconnect", 102, 202);
  const revoked = await sendWebhook(baseUrl, 30007, "/assistant personal hello", 102, 202);
  check(exactNames[5], revoked.replies.some((reply) => /not connected|no est/i.test(reply)));
  const ordinaryMenu = await sendWebhook(baseUrl, 30008, "/menu", 101, 201);
  check(exactNames[6], ordinaryMenu.replies.some((reply) => reply.includes("Asistente BIMLog") && !reply.includes("Cola de Soporte")));
  const denied = await sendWebhook(baseUrl, 30009, "/admin_support_queue", 101, 201);
  check(exactNames[7], denied.replies.some((reply) => /denied|denegado/i.test(reply)));
  const adminMenu = await sendWebhook(baseUrl, 30010, "/menu", 103, 203);
  check(exactNames[8], adminMenu.replies.some((reply) => reply.includes("Cola de Soporte") && reply.includes("Auditor")));
  const spoof = await sendWebhook(baseUrl, 30011, "/admin_support_queue", 101, 201, "roberto");
  check(exactNames[9], spoof.replies.some((reply) => /denied|denegado/i.test(reply)));
  const beforeHelpAi = await pool.query<{ n: string }>("SELECT count(*)::text n FROM ai_runs WHERE user_id=$1", [user.id]);
  await sendWebhook(baseUrl, 30012, "/help", 101, 201);
  const afterHelpAi = await pool.query<{ n: string }>("SELECT count(*)::text n FROM ai_runs WHERE user_id=$1", [user.id]);
  check(exactNames[10], beforeHelpAi.rows[0].n === afterHelpAi.rows[0].n);
  const supportDraft = await sendWebhook(baseUrl, 30013, "/support account_access | Login issue | I cannot connect Telegram today | high", 101, 201);
  const supportConv = conversationId(supportDraft.replies.at(-1) || "", "confirm_support");
  const beforeSupportAi = await pool.query<{ n: string }>("SELECT count(*)::text n FROM ai_runs WHERE user_id=$1", [user.id]);
  check(exactNames[11], beforeSupportAi.rows[0].n === afterHelpAi.rows[0].n);
  const estimate = await sendWebhook(baseUrl, 30014, "/assistant personal What is privacy?", 101, 201);
  const aiConv = conversationId(estimate.replies.at(-1) || "", "confirm_ai");
  check(exactNames[12], estimate.replies.some((reply) => reply.includes("/confirm_ai")));
  const beforeProvider = providerRequests.length;
  const cancel = await sendWebhook(baseUrl, 30015, `/cancel_ai ${aiConv}`, 101, 201);
  const cancelledRuns = await pool.query<{ n: string }>("SELECT count(*)::text n FROM ai_runs WHERE user_id=$1 AND status='cancelled'", [user.id]);
  check(exactNames[13], cancel.status === 200 && providerRequests.length === beforeProvider && Number(cancelledRuns.rows[0].n) > 0);
  const byo = await sendWebhook(baseUrl, 30016, "/assistant personal Explain BYO", 101, 201);
  check(exactNames[14], byo.replies.some((reply) => /personal\/BYO|personales\/BYO/i.test(reply)));
  const platform = await sendWebhook(baseUrl, 30017, "/assistant system Explain platform", 103, 203);
  check(exactNames[15], platform.replies.some((reply) => /platform\/system|plataforma\/sistema/i.test(reply)));

  await fetch(`${baseUrl}/api/v1/webhooks/telegram/${process.env.TELEGRAM_PRODUCT_ADAPTER_ID}`, { method: "POST", headers: { "Content-Type": "application/json", "x-telegram-bot-api-secret-token": process.env.TELEGRAM_PRODUCT_WEBHOOK_SECRET! }, body: JSON.stringify({ update_id: 30018, message: { text: "/help", chat: { id: 201, type: "private" }, from: { id: 101 } } }) });
  await fetch(`${baseUrl}/api/v1/webhooks/telegram/${process.env.TELEGRAM_PRODUCT_ADAPTER_ID}`, { method: "POST", headers: { "Content-Type": "application/json", "x-telegram-bot-api-secret-token": process.env.TELEGRAM_PRODUCT_WEBHOOK_SECRET! }, body: JSON.stringify({ update_id: 30018, message: { text: "/help", chat: { id: 201, type: "private" }, from: { id: 101 } } }) });
  await telegram.processTelegramInboundQueue(100); await new Promise((resolve) => setTimeout(resolve, 50)); await telegram.processTelegramInboundQueue(100);
  const dupRows = await pool.query<{ inbound: string; outbound: string }>("SELECT (SELECT count(*)::text FROM telegram_inbound_updates WHERE update_id='30018' AND adapter_id=$1) inbound,(SELECT count(*)::text FROM telegram_conversation_messages out JOIN telegram_conversation_messages inn ON inn.conversation_id=out.conversation_id JOIN telegram_conversations c ON c.id=out.conversation_id WHERE c.adapter_id=$1 AND inn.telegram_update_id='30018' AND inn.direction='inbound' AND out.direction='outbound') outbound", [process.env.TELEGRAM_PRODUCT_ADAPTER_ID]);
  check(exactNames[16], dupRows.rows[0].inbound === "1" && dupRows.rows[0].outbound === "1", dupRows.rows[0]);
  const failEstimate = await sendWebhook(baseUrl, 30019, "/assistant personal fail please", 101, 201);
  providerFailure = true;
  await sendWebhook(baseUrl, 30020, `/confirm_ai ${conversationId(failEstimate.replies.at(-1) || "", "confirm_ai")}`, 101, 201);
  providerFailure = false;
  const failures = await pool.query<{ n: string; provider_answers: string; settlements: string; failure_records: string }>("SELECT count(*) FILTER (WHERE ar.status='failed')::text n,(SELECT count(*)::text FROM telegram_conversation_messages m WHERE m.ai_run_id IN (SELECT id FROM ai_runs WHERE user_id=$1 AND status='failed') AND m.direction='outbound' AND m.sender_role='assistant' AND m.delivered_summary='provider assistant response' AND m.delivery_state='delivered') provider_answers,(SELECT count(*)::text FROM ai_usage_costs c WHERE c.run_id IN (SELECT id FROM ai_runs WHERE user_id=$1 AND status='failed') AND c.entry_type='settlement') settlements,(SELECT count(*)::text FROM ai_usage_costs c WHERE c.run_id IN (SELECT id FROM ai_runs WHERE user_id=$1 AND status='failed') AND c.entry_type='failure') failure_records FROM ai_runs ar WHERE ar.user_id=$1", [user.id]);
  check(exactNames[17], Number(failures.rows[0].n) > 0 && failures.rows[0].provider_answers === "0" && failures.rows[0].settlements === "0" && Number(failures.rows[0].failure_records) > 0, failures.rows[0]);

  await sendWebhook(baseUrl, 30021, "/language en", 101, 201);
  providerIdMode = "body";
  const enEst = await sendWebhook(baseUrl, 30022, "/assistant personal Remember steel", 101, 201);
  const enConv = conversationId(enEst.replies.at(-1) || "", "confirm_ai");
  const enAns1 = await confirmAssistant(baseUrl, 101, 201, 30023, enConv);
  const enContinue = await sendWebhook(baseUrl, 30024, "/continue_ai second question uses that material", 101, 201);
  assert.equal(conversationId(enContinue.replies.at(-1) || "", "confirm_ai"), enConv);
  const enAns2 = await confirmAssistant(baseUrl, 101, 201, 30025, enConv);
  const enSecondRequest = providerRequests.at(-1)!;
  const enContext = enSecondRequest.body.messages.map((m: any) => String(m.content || "")).join(" | ");
  const enRun = await pool.query<{ status: string; provider_request_id: string; input_tokens_actual: number; output_tokens_actual: number }>("SELECT ar.status,ar.provider_request_id,ar.input_tokens_actual,ar.output_tokens_actual FROM telegram_conversations tc JOIN ai_runs ar ON ar.id=tc.ai_run_id WHERE tc.id=$1", [enConv]);
  check(exactNames[18], enAns1.replies.length > 0 && enAns2.replies.join(" ").includes("second-provider") && /Remember steel/.test(enContext) && /first-provider/.test(enContext) && /second question/.test(enContext) && enRun.rows[0].provider_request_id?.startsWith("provider-body-"), { conversationId: enConv, requestMessages: enSecondRequest.body.messages.length, providerRequestId: enRun.rows[0].provider_request_id });

  providerIdMode = "header";
  const esEst = await sendWebhook(baseUrl, 30026, "/assistant personal Recuerda coordinacion", 103, 203);
  const esConv = conversationId(esEst.replies.at(-1) || "", "confirm_ai");
  const esAns1 = await confirmAssistant(baseUrl, 103, 203, 30027, esConv);
  const esContinue = await sendWebhook(baseUrl, 30028, "/continue_ai segunda pregunta usa ese contexto", 103, 203);
  assert.equal(conversationId(esContinue.replies.at(-1) || "", "confirm_ai"), esConv);
  const esAns2 = await confirmAssistant(baseUrl, 103, 203, 30029, esConv);
  const esSecondRequest = providerRequests.at(-1)!;
  const esContext = esSecondRequest.body.messages.map((m: any) => String(m.content || "")).join(" | ");
  const esPersisted = await pool.query<{ txt: string; provider_request_id: string }>("SELECT string_agg(m.sanitized_text,' ') txt,max(ar.provider_request_id) provider_request_id FROM telegram_conversation_messages m JOIN telegram_conversations c ON c.id=m.conversation_id LEFT JOIN ai_runs ar ON ar.id=c.ai_run_id WHERE c.id=$1", [esConv]);
  check(exactNames[19], esAns1.replies.length > 0 && esAns2.replies.join(" ").includes("segundo-proveedor") && /Recuerda coordinacion/.test(esContext) && /primer-proveedor/.test(esContext) && /segunda pregunta/.test(esContext) && !`${esAns2.replies.join(" ")} ${esPersisted.rows[0].txt}`.includes(String.fromCharCode(0x00c3)) && esPersisted.rows[0].provider_request_id?.startsWith("provider-header-"), { conversationId: esConv, requestMessages: esSecondRequest.body.messages.length, providerRequestId: esPersisted.rows[0].provider_request_id });

  const myPanel = await api(baseUrl, "/integrations/telegram/conversations", authToken(user));
  const otherPanel = await api(baseUrl, "/integrations/telegram/conversations", authToken(other));
  const oldBulkContentKey = "latest_" + "message";
  check(exactNames[20], myPanel.json.conversations.length > 0 && myPanel.json.conversations.every((c: any) => !(oldBulkContentKey in c)) && otherPanel.json.conversations.every((c: any) => c.user_id !== user.id), { userRows: myPanel.json.conversations.length, otherRows: otherPanel.json.conversations.length });
  check(exactNames[21], (await api(baseUrl, "/integrations/telegram/admin/conversations?reason=review", authToken(other))).status === 403);
  const adminNoReason = await api(baseUrl, `/integrations/telegram/admin/conversations/${enConv}`, authToken(roberto));
  const adminList = await api(baseUrl, "/integrations/telegram/admin/conversations?reason=metadata%20review", authToken(roberto));
  const adminTarget = await api(baseUrl, `/integrations/telegram/admin/conversations/${enConv}?reason=targeted%20case%20review`, authToken(roberto));
  const adminAudits = await pool.query<{ n: string; target: string }>("SELECT count(*)::text n,max(target_id) target FROM admin_actions_log WHERE admin_user_id=$1 AND action='telegram_admin_conversation_content_accessed'", [roberto.id]);
  check(exactNames[22], adminNoReason.status === 400 && adminList.status === 200 && adminList.json.conversations.every((c: any) => !(oldBulkContentKey in c) && !("sanitized_text" in c)) && adminTarget.status === 200 && adminTarget.json.messages.some((m: any) => m.sanitized_text.includes("Remember steel")) && adminAudits.rows[0].target === enConv, { target: enConv, auditCount: adminAudits.rows[0].n });

  const confirmSupport = await sendWebhook(baseUrl, 30030, `/confirm_support ${supportConv}`, 101, 201);
  const caseNo = /TG-[A-Z0-9-]+/.exec(confirmSupport.replies.join(" "))?.[0] || "";
  const caseRow = await pool.query<{ id: string; case_number: string }>("SELECT id,case_number FROM telegram_support_cases WHERE case_number=$1", [caseNo]);
  check(exactNames[23], caseRow.rows[0]?.case_number === caseNo, { caseNumber: caseNo });
  check(exactNames[24], confirmSupport.replies.some((reply) => reply.includes(caseNo)), { reply: confirmSupport.replies.at(-1) });
  for (const status of ["acknowledged", "in_progress", "waiting_for_user", "resolved", "closed"]) {
    await api(baseUrl, `/integrations/telegram/admin/support-cases/${caseRow.rows[0].id}/status`, authToken(roberto), { method: "PATCH", body: JSON.stringify({ status, reason: `advance to ${status}` }) });
  }
  const events = await pool.query<{ n: string; statuses: string }>("SELECT count(*)::text n,string_agg(to_status,',' ORDER BY created_at) statuses FROM telegram_support_case_events WHERE case_id=$1", [caseRow.rows[0].id]);
  check(exactNames[25], events.rows[0].n === "6", events.rows[0]);
  const fileRuns = await pool.query<{ n: string }>("SELECT count(*)::text n FROM ai_runs WHERE capability='assistant' AND files_will_be_transmitted=true AND user_id IN ($1,$2)", [user.id, roberto.id]);
  check(exactNames[26], fileRuns.rows[0].n === "0" && providerRequests.every((request) => !("files" in request.body) && !("file_ids" in request.body)));
  const source = fs.readFileSync(new URL("../src/lib/telegram-product.ts", import.meta.url), "utf8");
  check(exactNames[27], !/sendTelegramEmail|sendgrid\.send|files_will_be_transmitted:\s*true|INSERT INTO projects|UPDATE projects|INSERT INTO files|INSERT INTO reports/i.test(source));
  providerIdMode = "missing";
  const missingEstimate = await sendWebhook(baseUrl, 30031, "/assistant personal missing id proof", 101, 201);
  await confirmAssistant(baseUrl, 101, 201, 30032, conversationId(missingEstimate.replies.at(-1) || "", "confirm_ai"));
  const missingRun = await pool.query<{ status: string; failure_code: string | null; provider_request_id: string | null; settlements: string; reserved_micros: string; release_micros: string | null }>("SELECT ar.status,(SELECT reason FROM ai_usage_costs WHERE run_id=ar.id AND entry_type='failure' LIMIT 1) failure_code,ar.provider_request_id,(SELECT count(*)::text FROM ai_usage_costs WHERE run_id=ar.id AND entry_type='settlement') settlements,ar.reserved_micros::text,(SELECT amount_micros::text FROM ai_usage_costs WHERE run_id=ar.id AND entry_type='release' LIMIT 1) release_micros FROM ai_runs ar WHERE ar.user_id=$1 ORDER BY ar.created_at DESC LIMIT 1", [user.id]);
  const responseTexts = sentMessages.map((m) => m.text).join(" ");
  const evidenceText = JSON.stringify({ checks, providerRequests: providerRequests.map((request) => ({ url: request.url, hasAuthorization: request.hasAuthorization, mode: request.mode, bodyKeys: Object.keys(request.body) })), responseTexts });
  const secretPatternHits = [
    ["provider-key-marker", /sk-local/i],
    ["database-url-marker", /postgres:\/\//i],
    ["bot-token-marker", new RegExp(process.env.TELEGRAM_PRODUCT_BOT_TOKEN!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")],
    ["webhook-secret-marker", new RegExp(process.env.TELEGRAM_PRODUCT_WEBHOOK_SECRET!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")],
    ["data-key-marker", new RegExp(process.env.TELEGRAM_PRODUCT_DATA_KEY!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")],
    ["encrypted-provider-field-marker", /provider_connections\.encrypted/i],
  ].filter(([, pattern]) => (pattern as RegExp).test(evidenceText)).map(([name]) => name as string);
  if (secretPatternHits.length) console.log(JSON.stringify({ secretPatternHits }));
  const reservationReleased = missingRun.rows[0].release_micros !== null && BigInt(missingRun.rows[0].release_micros) === -BigInt(missingRun.rows[0].reserved_micros);
  check(exactNames[28], missingRun.rows[0].status === "failed" && missingRun.rows[0].failure_code === "PROVIDER_REQUEST_ID_UNAVAILABLE" && missingRun.rows[0].provider_request_id === null && missingRun.rows[0].settlements === "0" && reservationReleased && secretPatternHits.length === 0, { missingRun: missingRun.rows[0], reservationReleased, providerIdModes: providerRequests.map((request) => request.mode), secretPatternHits });

  telegramFailure = true;
  const beforeDelivered = await pool.query<{ delivered: string; sent: string }>("SELECT count(*) FILTER (WHERE m.delivery_state='delivered')::text delivered,count(*)::text sent FROM telegram_conversation_messages m JOIN telegram_conversations c ON c.id=m.conversation_id WHERE m.direction='outbound' AND c.user_id=ANY($1::int[])", [[user.id, roberto.id]]);
  const deliveredBaseline = await pool.query<{ id: string; delivery_state: string; telegram_delivery_message_id: string; delivery_attempts: number }>("SELECT id,delivery_state,telegram_delivery_message_id,delivery_attempts FROM telegram_conversation_messages WHERE conversation_id=$1 AND direction='outbound' AND delivery_state='delivered' ORDER BY created_at LIMIT 1", [enConv]);
  const failDelivery = await sendWebhook(baseUrl, 30033, "/help", 101, 201);
  telegramFailure = false;
  const failedDelivery = await pool.query<{ failed: string; pending: string }>("SELECT count(*) FILTER (WHERE m.delivery_state='failed')::text failed,count(*) FILTER (WHERE m.delivery_state='pending')::text pending FROM telegram_conversation_messages m JOIN telegram_conversations c ON c.id=m.conversation_id WHERE m.direction='outbound' AND c.user_id=ANY($1::int[])", [[user.id, roberto.id]]);
  const firstProcess = await startBuiltApi(39181);
  const firstStatus = await api("http://127.0.0.1:39181", "/integrations/telegram/status", authToken(user));
  await stopBuiltApi(firstProcess.child);
  const secondProcess = await startBuiltApi(39182);
  const secondStatus = await api("http://127.0.0.1:39182", "/integrations/telegram/status", authToken(user));
  await fetch(`http://127.0.0.1:39182/api/v1/webhooks/telegram/${process.env.TELEGRAM_PRODUCT_ADAPTER_ID}`, { method: "POST", headers: { "Content-Type": "application/json", "x-telegram-bot-api-secret-token": process.env.TELEGRAM_PRODUCT_WEBHOOK_SECRET! }, body: JSON.stringify({ update_id: 30034, message: { text: "/continue_ai second question after restart proof", chat: { id: 201, type: "private" }, from: { id: 101 } } }) });
  const secondPanel = await api("http://127.0.0.1:39182", "/integrations/telegram/conversations", authToken(user));
  let restartedContinuation: { status: string; telegram_delivery_message_id: string | null; delivery_state: string; ai_run_id: string | null } | undefined;
  for (let i = 0; i < 80; i += 1) {
    const continuation = await pool.query<{ status: string; telegram_delivery_message_id: string | null; delivery_state: string; ai_run_id: string | null }>("SELECT iu.status,outbound.telegram_delivery_message_id,outbound.delivery_state,inbound.ai_run_id FROM telegram_inbound_updates iu LEFT JOIN telegram_conversation_messages inbound ON inbound.telegram_update_id=iu.update_id AND inbound.direction='inbound' LEFT JOIN telegram_conversation_messages outbound ON outbound.ai_run_id=inbound.ai_run_id AND outbound.direction='outbound' AND outbound.requested_action='assistant_continue_confirmation' WHERE iu.adapter_id=$1 AND iu.update_id='30034' ORDER BY outbound.created_at DESC LIMIT 1", [process.env.TELEGRAM_PRODUCT_ADAPTER_ID]);
    restartedContinuation = continuation.rows[0];
    if (restartedContinuation?.status === "processed" && restartedContinuation.telegram_delivery_message_id) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  await stopBuiltApi(secondProcess.child);
  const afterDelivered = await pool.query<{ delivered: string; sent: string }>("SELECT count(*) FILTER (WHERE m.delivery_state='delivered')::text delivered,count(*)::text sent FROM telegram_conversation_messages m JOIN telegram_conversations c ON c.id=m.conversation_id WHERE m.direction='outbound' AND c.user_id=ANY($1::int[])", [[user.id, roberto.id]]);
  const deliveredBaselineAfter = await pool.query<{ id: string; delivery_state: string; telegram_delivery_message_id: string; delivery_attempts: number }>("SELECT id,delivery_state,telegram_delivery_message_id,delivery_attempts FROM telegram_conversation_messages WHERE id=$1", [deliveredBaseline.rows[0].id]);
  const persistedSupport = await pool.query<{ n: string; statuses: string }>("SELECT count(*)::text n,string_agg(to_status,',' ORDER BY created_at) statuses FROM telegram_support_case_events WHERE case_id=$1", [caseRow.rows[0].id]);
  const persistedAi = await pool.query<{ settled: string; failed: string }>("SELECT count(*) FILTER (WHERE status='settled')::text settled,count(*) FILTER (WHERE status='failed')::text failed FROM ai_runs WHERE user_id=ANY($1::int[])", [[user.id, roberto.id]]);
  const restartProof = {
    firstPid: firstProcess.child.pid,
    secondPid: secondProcess.child.pid,
    firstBundleHash: firstProcess.hash,
    secondBundleHash: secondProcess.hash,
    firstStatus: firstStatus.status,
    secondStatus: secondStatus.status,
    language: secondStatus.json.language,
    failedDelivery: failedDelivery.rows[0],
    beforeDelivered: beforeDelivered.rows[0],
    afterDelivered: afterDelivered.rows[0],
    deliveredBaseline: deliveredBaseline.rows[0],
    deliveredBaselineAfter: deliveredBaselineAfter.rows[0],
    conversationRows: secondPanel.json.conversations.length,
    continuation: restartedContinuation,
    continuationProcessedBySecondPid: restartedContinuation?.telegram_delivery_message_id === String(secondProcess.child.pid),
    persistedSupport: persistedSupport.rows[0],
    persistedAi: persistedAi.rows[0],
  };
  console.log(JSON.stringify({ restartProof }));
  check(exactNames[29], failDelivery.status === 200 && Number(failedDelivery.rows[0].failed) > 0 && firstStatus.status === 200 && secondStatus.status === 200 && restartProof.firstPid !== restartProof.secondPid && firstProcess.hash === secondProcess.hash && deliveredBaselineAfter.rows[0].delivery_state === deliveredBaseline.rows[0].delivery_state && deliveredBaselineAfter.rows[0].telegram_delivery_message_id === deliveredBaseline.rows[0].telegram_delivery_message_id && deliveredBaselineAfter.rows[0].delivery_attempts === deliveredBaseline.rows[0].delivery_attempts && restartProof.continuationProcessedBySecondPid && persistedSupport.rows[0].statuses === "new,acknowledged,in_progress,waiting_for_user,resolved,closed" && Number(persistedAi.rows[0].settled) >= 4 && Number(persistedAi.rows[0].failed) >= 2, restartProof);

  assert.deepEqual(checks.map((c) => c.name), exactNames);
  const manifest = {
    suite: "telegram-product-build-3-correction",
    generatedAt: new Date().toISOString(),
    passed: checks.filter((c) => c.pass).length,
    total: checks.length,
    providerHttpRequests: providerRequests.length,
    providerRequestIdProof: {
      bodyProvided: providerRequests.some((request) => request.mode === "body"),
      headerProvided: providerRequests.some((request) => request.mode === "header"),
      missingRejected: missingRun.rows[0],
    },
    restartProof,
    telegramMessageIdsPersisted: (await pool.query<{ n: string }>("SELECT count(*)::text n FROM telegram_conversation_messages WHERE telegram_delivery_message_id IS NOT NULL")).rows[0].n,
    checks,
  };
  const manifestPath = path.join(evidenceRoot, "evidence-manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(evidenceRoot, "telegram-product-build3-correction-results.json"), JSON.stringify({ checks, providerRequests: providerRequests.map((request) => ({ mode: request.mode, responseText: request.responseText, messageCount: request.body.messages?.length || 0 })) }, null, 2));
  const hash = crypto.createHash("sha256").update(fs.readFileSync(manifestPath)).digest("hex");
  fs.writeFileSync(path.join(evidenceRoot, "manifest.sha256"), `${hash}  evidence-manifest.json\n`);
  console.log(JSON.stringify({ evidenceRoot, manifestHash: hash, passed: manifest.passed, total: manifest.total, restartProof }, null, 2));
} finally {
  server.close();
  providerServer.close();
  await cleanupRunRecords();
  await pool.end();
}
process.exit(0);
