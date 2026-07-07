import Anthropic from "@anthropic-ai/sdk";
import { db } from "@workspace/db";
import { aiUsageEventsTable, userConnectionsTable, usersTable } from "@workspace/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";

const INTERNAL_AI_EMAILS = new Set([
  "robertor@rryasociados.com",
  "robertor@bimcorpinc.com",
  "robertor@bimcorpin.com",
  "robertor9876@gmail.com",
]);

type AiClientInput = {
  userId: number;
  projectId?: number | null;
  feature: string;
};

type KnownAiErrorCode = "AI_SETUP_REQUIRED" | "AI_LIMIT_REACHED" | "AI_PLATFORM_NOT_CONFIGURED";

export class AiUsageError extends Error {
  status: number;
  code: KnownAiErrorCode;
  details?: Record<string, unknown>;

  constructor(status: number, code: KnownAiErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isInternalAiUser(email?: string | null) {
  return Boolean(email && INTERNAL_AI_EMAILS.has(email.trim().toLowerCase()));
}

function platformAnthropicKey() {
  return process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? "";
}

function platformAnthropicBaseUrl() {
  return process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL || undefined;
}

function monthlyLimit() {
  const raw = Number(process.env.BIMLOG_INCLUDED_AI_MONTHLY_LIMIT ?? "25");
  return Number.isFinite(raw) && raw >= 0 ? raw : 25;
}

function monthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

async function recordAiUsage(input: AiClientInput, provider: string, billingMode: string) {
  await db.insert(aiUsageEventsTable).values({
    userId: input.userId,
    projectId: input.projectId ?? null,
    feature: input.feature,
    provider,
    billingMode,
    estimatedUnits: 1,
  });
}

async function includedUsageThisMonth(userId: number) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(aiUsageEventsTable)
    .where(and(
      eq(aiUsageEventsTable.userId, userId),
      eq(aiUsageEventsTable.billingMode, "included_platform"),
      gte(aiUsageEventsTable.createdAt, monthStart()),
    ));
  return Number(row?.count ?? 0);
}

export async function getAnthropicClientForUser(input: AiClientInput) {
  const [user] = await db
    .select({ email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, input.userId))
    .limit(1);

  if (!user) {
    throw new AiUsageError(404, "AI_SETUP_REQUIRED", "User not found.");
  }

  const platformKey = platformAnthropicKey();
  const platformBaseURL = platformAnthropicBaseUrl();

  if (isInternalAiUser(user.email)) {
    if (!platformKey) {
      throw new AiUsageError(503, "AI_PLATFORM_NOT_CONFIGURED", "BIMLog AI is not configured.");
    }
    await recordAiUsage(input, "anthropic", "platform_internal");
    return new Anthropic({ apiKey: platformKey, baseURL: platformBaseURL });
  }

  const [connection] = await db
    .select()
    .from(userConnectionsTable)
    .where(and(
      eq(userConnectionsTable.userId, input.userId),
      eq(userConnectionsTable.provider, "anthropic"),
      eq(userConnectionsTable.status, "connected"),
    ))
    .limit(1);

  const credentials = (connection?.credentials ?? {}) as { apiKey?: unknown; baseURL?: unknown };
  if (typeof credentials.apiKey === "string" && credentials.apiKey.trim()) {
    await recordAiUsage(input, "anthropic", "user_key");
    return new Anthropic({
      apiKey: credentials.apiKey.trim(),
      baseURL: typeof credentials.baseURL === "string" && credentials.baseURL.trim()
        ? credentials.baseURL.trim()
        : platformBaseURL,
    });
  }

  if (!platformKey) {
    throw new AiUsageError(
      428,
      "AI_SETUP_REQUIRED",
      "Connect your own AI provider in Integrations before using AI.",
    );
  }

  const limit = monthlyLimit();
  const used = await includedUsageThisMonth(input.userId);
  if (used >= limit) {
    throw new AiUsageError(
      402,
      "AI_LIMIT_REACHED",
      "Your included BIMLog AI credits are used up for this month. Connect your own AI provider in Integrations to continue.",
      { used, limit },
    );
  }

  await recordAiUsage(input, "anthropic", "included_platform");
  return new Anthropic({ apiKey: platformKey, baseURL: platformBaseURL });
}

export function sendAiUsageError(res: { status: (code: number) => { json: (body: unknown) => void } }, error: unknown) {
  if (error instanceof AiUsageError) {
    res.status(error.status).json({
      error: error.message,
      code: error.code,
      details: error.details,
    });
    return true;
  }
  return false;
}
