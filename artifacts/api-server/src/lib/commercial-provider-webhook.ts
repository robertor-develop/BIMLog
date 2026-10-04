import crypto from "node:crypto";
import { inspectStripeCommercialConfiguration, verifyStripeWebhook } from "./commercial-provider-adapter";
import type { CommercialQueryClient } from "./commercial-persistence";

export type CommercialWebhookResult = Readonly<{
  accepted: true;
  eventId: string;
  outcome: "applied" | "ignored" | "replayed";
}>;

type StripeCheckoutObject = Readonly<{
  id?: unknown;
  customer?: unknown;
  metadata?: Readonly<Record<string, unknown>>;
}>;

type StripeWebhookEnvelope = Readonly<{
  id?: unknown;
  type?: unknown;
  data?: Readonly<{ object?: StripeCheckoutObject }>;
}>;

function parseVerifiedEnvelope(rawPayload: string): StripeWebhookEnvelope {
  let value: unknown;
  try { value = JSON.parse(rawPayload); } catch { throw new Error("COMMERCIAL_WEBHOOK_INVALID_JSON"); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("COMMERCIAL_WEBHOOK_INVALID_ENVELOPE");
  return value as StripeWebhookEnvelope;
}

function exactId(value: unknown, code: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/.test(value)) throw new Error(code);
  return value;
}

export function inspectCommercialWebhookEnvironment(environment: NodeJS.ProcessEnv): Readonly<{
  webhookSecret: string;
  mode: "test" | "live";
}> {
  const inspected = inspectStripeCommercialConfiguration({
    secretKey: environment.STRIPE_SECRET_KEY,
    webhookSecret: environment.STRIPE_WEBHOOK_SECRET,
    portalConfigurationId: environment.STRIPE_PORTAL_CONFIGURATION_ID,
    appOrigin: environment.BIMLOG_APP_ORIGIN ?? "https://bimlog.app",
    apiVersion: environment.STRIPE_API_VERSION,
  });
  if (!inspected.configuration || !inspected.readiness.webhookConfigured) throw new Error("COMMERCIAL_WEBHOOK_NOT_CONFIGURED");
  return Object.freeze({ webhookSecret: inspected.configuration.webhookSecret, mode: inspected.readiness.mode });
}

export async function acceptPersistentStripeWebhook(input: Readonly<{
  client: CommercialQueryClient;
  environment: NodeJS.ProcessEnv;
  rawPayload: string;
  signatureHeader: string;
  now: Date;
}>): Promise<CommercialWebhookResult> {
  if (!input.rawPayload || Buffer.byteLength(input.rawPayload, "utf8") > 1_048_576) throw new Error("COMMERCIAL_WEBHOOK_PAYLOAD_INVALID");
  const nowEpochSeconds = Math.floor(input.now.getTime() / 1000);
  if (!Number.isSafeInteger(nowEpochSeconds)) throw new Error("COMMERCIAL_WEBHOOK_TIME_INVALID");
  const configuration = inspectCommercialWebhookEnvironment(input.environment);
  const receipt = verifyStripeWebhook({
    rawPayload: input.rawPayload,
    signatureHeader: input.signatureHeader,
    webhookSecret: configuration.webhookSecret,
    nowEpochSeconds,
    priorReceipts: [],
  });
  parseVerifiedEnvelope(input.rawPayload);
  void input.client;
  return Object.freeze({ accepted: true, eventId: receipt.eventId, outcome: "ignored" });
}

export const commercialWebhookInternals = Object.freeze({
  parseVerifiedEnvelope,
  digest: (value: string) => crypto.createHash("sha256").update(value).digest("hex"),
});
