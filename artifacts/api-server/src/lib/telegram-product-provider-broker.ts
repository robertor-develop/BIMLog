import { pool } from "@workspace/db";
import { AiControlError, failRunFromBroker, settleRunFromBroker, withProviderSecret, type Actor, type ProviderName } from "./ai-control-plane";

export class TelegramProviderBrokerError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 502) {
    super(message);
  }
}

type BrokerMessage = { role: "user" | "assistant" | "system"; content: string };
type BrokerResult = { text: string; providerRequestId: string; inputTokens: number; outputTokens: number };
export type TelegramDeliveryIntent =
  | { kind: "delivery"; projectId: number; artifactType: string; entityId: number; channel: "telegram" | "email"; recipients: string | string[] }
  | { kind: "ambiguous"; missing: string[] };

const OPENAI_BASE_URL = "https://api.openai.com/v1";
const ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1";

function endpoint(provider: ProviderName): string {
  if (provider === "openai") return `${(process.env.OPENAI_API_BASE_URL || OPENAI_BASE_URL).replace(/\/$/, "")}/chat/completions`;
  if (provider === "anthropic") return `${(process.env.ANTHROPIC_API_BASE_URL || ANTHROPIC_BASE_URL).replace(/\/$/, "")}/messages`;
  throw new TelegramProviderBrokerError("PROVIDER_UNSUPPORTED", "Unsupported provider.", 400);
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim() : "";
}

function positiveUsage(value: unknown): number | null {
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

async function callOpenAi(model: string, secret: string, messages: BrokerMessage[], transport: typeof fetch): Promise<BrokerResult> {
  const response = await transport(endpoint("openai"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
    body: JSON.stringify({ model, messages, temperature: 0.2 }),
  });
  const requestId = response.headers.get("x-request-id") || "";
  const body = await response.json().catch(() => ({})) as any;
  if (!response.ok) throw new TelegramProviderBrokerError("PROVIDER_REQUEST_FAILED", "Provider request failed.");
  const text = cleanText(body?.choices?.[0]?.message?.content);
  const inputTokens = positiveUsage(body?.usage?.prompt_tokens);
  const outputTokens = positiveUsage(body?.usage?.completion_tokens);
  if (!text) throw new TelegramProviderBrokerError("PROVIDER_EMPTY_RESPONSE", "Provider returned no assistant text.");
  if (inputTokens == null || outputTokens == null) throw new TelegramProviderBrokerError("PROVIDER_USAGE_UNAVAILABLE", "Provider usage was not available.");
  const providerRequestId = cleanText(body?.id) || requestId;
  if (!providerRequestId) throw new TelegramProviderBrokerError("PROVIDER_REQUEST_ID_UNAVAILABLE", "Provider request identifier was not available.");
  return { text, providerRequestId, inputTokens, outputTokens };
}

async function callAnthropic(model: string, secret: string, messages: BrokerMessage[], transport: typeof fetch): Promise<BrokerResult> {
  const system = messages.find((m) => m.role === "system")?.content || "";
  const conversation = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));
  const response = await transport(endpoint("anthropic"), {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": secret, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, system, max_tokens: 800, messages: conversation }),
  });
  const requestId = response.headers.get("request-id") || "";
  const body = await response.json().catch(() => ({})) as any;
  if (!response.ok) throw new TelegramProviderBrokerError("PROVIDER_REQUEST_FAILED", "Provider request failed.");
  const text = cleanText((body?.content || []).map((part: any) => part?.type === "text" ? part.text : "").join(" "));
  const inputTokens = positiveUsage(body?.usage?.input_tokens);
  const outputTokens = positiveUsage(body?.usage?.output_tokens);
  if (!text) throw new TelegramProviderBrokerError("PROVIDER_EMPTY_RESPONSE", "Provider returned no assistant text.");
  if (inputTokens == null || outputTokens == null) throw new TelegramProviderBrokerError("PROVIDER_USAGE_UNAVAILABLE", "Provider usage was not available.");
  const providerRequestId = cleanText(body?.id) || requestId;
  if (!providerRequestId) throw new TelegramProviderBrokerError("PROVIDER_REQUEST_ID_UNAVAILABLE", "Provider request identifier was not available.");
  return { text, providerRequestId, inputTokens, outputTokens };
}

export async function executeTelegramAssistantBroker(actor: Actor, runId: string, messages: BrokerMessage[], transport: typeof fetch = fetch): Promise<BrokerResult> {
  const runResult = await pool.query(`SELECT r.*, pc.provider AS connection_provider, pc.status AS connection_status, pc.owner_type AS connection_owner_type
    FROM ai_runs r JOIN provider_connections pc ON pc.id=r.connection_id
    WHERE r.id=$1 AND r.user_id=$2 AND r.company_id=$3 AND r.status='reserved'`, [runId, actor.userId, actor.companyId]);
  const run = runResult.rows[0];
  if (!run) throw new TelegramProviderBrokerError("RUN_NOT_RESERVED", "AI run is not reserved.", 409);
  if (run.capability !== "assistant" || run.files_will_be_transmitted === true) throw new TelegramProviderBrokerError("RUN_SCOPE_INVALID", "Telegram assistant run scope is invalid.", 409);
  if (run.connection_status !== "active" || run.connection_provider !== run.provider || run.connection_owner_type !== run.credit_owner_type) throw new TelegramProviderBrokerError("RUN_CONNECTION_CHANGED", "Provider connection changed.", 409);
  const ent = await pool.query(`SELECT id FROM entitlement_rules WHERE id=$1 AND enabled=true AND effective_from<=now() AND (effective_to IS NULL OR effective_to>now())`, [run.entitlement_rule_id]);
  const budget = await pool.query(`SELECT id FROM company_ai_budgets WHERE id=$1 AND status='active' AND effective_from<=now() AND (effective_to IS NULL OR effective_to>now())`, [run.budget_id]);
  if (!ent.rows[0] || !budget.rows[0]) throw new TelegramProviderBrokerError("RUN_POLICY_CHANGED", "AI policy changed.", 409);
  const bounded = messages.slice(-9).map((m) => ({ role: m.role, content: cleanText(m.content).slice(0, 1800) })).filter((m) => m.content);
  if (!bounded.some((m) => m.role === "user")) throw new TelegramProviderBrokerError("CONTEXT_REQUIRED", "Conversation context is required.", 400);
  try {
    const result = await withProviderSecret(actor, run.connection_id, async (provider, secret) => {
      if (provider === "openai") return callOpenAi(run.model, secret, bounded, transport);
      if (provider === "anthropic") return callAnthropic(run.model, secret, bounded, transport);
      throw new TelegramProviderBrokerError("PROVIDER_UNSUPPORTED", "Unsupported provider.", 400);
    });
    await settleRunFromBroker({ source: "provider_broker", runId, inputTokens: result.inputTokens, outputTokens: result.outputTokens, providerRequestId: result.providerRequestId });
    return result;
  } catch (error) {
    const code = error instanceof TelegramProviderBrokerError ? error.code : error instanceof AiControlError ? error.code : "PROVIDER_REQUEST_FAILED";
    await failRunFromBroker({ source: "provider_broker", runId, providerRequestId: undefined, errorCode: code });
    throw error;
  }
}

function deliveryIntentFromText(text: string): TelegramDeliveryIntent {
  const candidate = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)?.[1] || text;
  let value: any;
  try { value = JSON.parse(candidate); }
  catch { throw new TelegramProviderBrokerError("DELIVERY_INTENT_INVALID", "Provider did not return valid structured delivery intent.", 422); }
  if (value?.kind === "ambiguous") {
    const missing = Array.isArray(value.missing) ? value.missing.map(cleanText).filter(Boolean).slice(0, 8) : [];
    return { kind: "ambiguous", missing: missing.length ? missing : ["delivery details"] };
  }
  const projectId = Number(value?.projectId);
  const entityId = Number(value?.entityId);
  const artifactType = cleanText(value?.artifactType);
  const channel = cleanText(value?.channel).toLowerCase();
  const recipients = Array.isArray(value?.recipients)
    ? value.recipients.map(cleanText).filter(Boolean).slice(0, 25)
    : cleanText(value?.recipients);
  if (value?.kind !== "delivery" || !Number.isSafeInteger(projectId) || projectId <= 0 || !Number.isSafeInteger(entityId) || entityId <= 0 || !artifactType || !["telegram", "email"].includes(channel) || (Array.isArray(recipients) ? !recipients.length : !recipients)) {
    throw new TelegramProviderBrokerError("DELIVERY_INTENT_INVALID", "Provider delivery intent was incomplete or malformed.", 422);
  }
  return { kind: "delivery", projectId, entityId, artifactType, channel: channel as "telegram" | "email", recipients };
}

export async function executeTelegramDeliveryIntentBroker(
  actor: Actor,
  runId: string,
  messages: BrokerMessage[],
  transport: typeof fetch = fetch,
): Promise<{ intent: TelegramDeliveryIntent; providerRequestId: string }> {
  const result = await executeTelegramAssistantBroker(actor, runId, messages, transport);
  return { intent: deliveryIntentFromText(result.text), providerRequestId: result.providerRequestId };
}
