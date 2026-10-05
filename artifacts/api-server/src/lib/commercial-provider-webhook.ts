import crypto from "node:crypto";
import { inspectStripeCommercialConfiguration, verifyStripeWebhook } from "./commercial-provider-adapter";
import {
  applyPersistentCheckoutCompletion,
  claimPersistentProviderReceipt,
  persistVerifiedProviderReceipt,
  settlePersistentProviderReceipt,
  type CommercialQueryClient,
} from "./commercial-persistence";

export type CommercialWebhookResult = Readonly<{
  accepted: true;
  eventId: string;
  outcome: "applied" | "failed" | "ignored" | "replayed";
}>;

type StripeCheckoutObject = Readonly<{
  id?: unknown;
  customer?: unknown;
  subscription?: unknown;
  mode?: unknown;
  status?: unknown;
  payment_status?: unknown;
  currency?: unknown;
  amount_total?: unknown;
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

export function classifyCommercialCheckoutFailure(error:unknown):"LINEAGE_NOT_FOUND"|"AMOUNT_MISMATCH"|"UNSUPPORTED_STATE"{
  const message=error instanceof Error?error.message:"";
  if(/amount|currency/i.test(message))return "AMOUNT_MISMATCH";
  if(/payment|status|mode/i.test(message))return "UNSUPPORTED_STATE";
  return "LINEAGE_NOT_FOUND";
}

export function validateStripeCheckoutCompletion(object: StripeCheckoutObject | undefined): Readonly<{
  sessionId:string;customerReference:string;providerSubscriptionReference:string;currency:string;amountTotalCents:number;
}> {
  if(!object)throw new Error("COMMERCIAL_WEBHOOK_SESSION_INVALID");
  const sessionId=exactId(object.id,"COMMERCIAL_WEBHOOK_SESSION_INVALID");
  const customerReference=exactId(object.customer,"COMMERCIAL_WEBHOOK_CUSTOMER_MISSING");
  const providerSubscriptionReference=exactId(object.subscription,"COMMERCIAL_WEBHOOK_PROVIDER_SUBSCRIPTION_MISSING");
  if(object.mode!=="subscription"||object.status!=="complete"||object.payment_status!=="paid")throw new Error("COMMERCIAL_WEBHOOK_PAYMENT_INCOMPLETE");
  if(typeof object.currency!=="string"||!/^[a-z]{3}$/.test(object.currency))throw new Error("COMMERCIAL_WEBHOOK_CURRENCY_INVALID");
  if(!Number.isSafeInteger(object.amount_total)||Number(object.amount_total)<0)throw new Error("COMMERCIAL_WEBHOOK_AMOUNT_INVALID");
  return Object.freeze({sessionId,customerReference,providerSubscriptionReference,currency:object.currency.toUpperCase(),amountTotalCents:Number(object.amount_total)});
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
  const envelope = parseVerifiedEnvelope(input.rawPayload);
  const completion=receipt.eventType==="checkout.session.completed"?validateStripeCheckoutCompletion(envelope.data?.object):null;
  const customerReference = completion?.customerReference??exactId(envelope.data?.object?.customer, "COMMERCIAL_WEBHOOK_CUSTOMER_MISSING");
  const binding = await input.client.query(
    `SELECT id,company_id FROM commercial_provider_bindings WHERE provider='stripe' AND environment=$1 AND customer_reference=$2 AND status='active' LIMIT 1`,
    [configuration.mode, customerReference],
  );
  const bindingRow = binding.rows[0];
  if (!bindingRow) throw new Error("COMMERCIAL_WEBHOOK_BINDING_UNAVAILABLE");
  const companyId = Number(bindingRow.company_id);
  if (!Number.isSafeInteger(companyId) || companyId < 1) throw new Error("COMMERCIAL_WEBHOOK_COMPANY_INVALID");
  const providerBindingId = exactId(bindingRow.id, "COMMERCIAL_WEBHOOK_BINDING_INVALID");
  const persisted = await persistVerifiedProviderReceipt(input.client, {
    id: `receipt-${receipt.eventId}`,
    companyId,
    providerBindingId,
    providerEventReference: receipt.eventId,
    eventType: receipt.eventType,
    rawPayload: input.rawPayload,
    payloadDigest: receipt.payloadDigest,
    signatureVerifiedAt: receipt.receivedAt,
  });
  if (persisted.replayed) return Object.freeze({ accepted: true, eventId: receipt.eventId, outcome: "replayed" });
  if (receipt.eventType !== "checkout.session.completed") {
    await settlePersistentProviderReceipt(input.client, {
      id: persisted.id,
      companyId,
      outcome: "ignored",
      failureCode: "UNSUPPORTED_EVENT_TYPE",
      processedAt: input.now.toISOString(),
    });
    return Object.freeze({ accepted: true, eventId: receipt.eventId, outcome: "ignored" });
  }

  await claimPersistentProviderReceipt(input.client, {
    id: persisted.id,
    companyId,
    expectedEventType: receipt.eventType,
  });
  try {
    const object = envelope.data?.object;
    const checkout = await input.client.query(
      `SELECT id FROM commercial_checkout_attempts WHERE company_id=$1 AND provider_binding_id=$2 AND provider_session_reference=$3 LIMIT 1`,
      [companyId, providerBindingId, exactId(object?.id, "COMMERCIAL_WEBHOOK_SESSION_INVALID")],
    );
    await applyPersistentCheckoutCompletion(input.client, {
      companyId,
      receiptId: persisted.id,
      subscriptionId: exactId(object?.metadata?.subscription_id, "COMMERCIAL_WEBHOOK_SUBSCRIPTION_INVALID"),
      orderId: exactId(object?.metadata?.order_id, "COMMERCIAL_WEBHOOK_ORDER_INVALID"),
      checkoutId: exactId(checkout.rows[0]?.id, "COMMERCIAL_WEBHOOK_CHECKOUT_UNAVAILABLE"),
      completedAt: input.now.toISOString(),
    });
    return Object.freeze({ accepted: true, eventId: receipt.eventId, outcome: "applied" });
  } catch(error) {
    await settlePersistentProviderReceipt(input.client, {
      id: persisted.id,
      companyId,
      outcome: "failed",
      failureCode: classifyCommercialCheckoutFailure(error),
      processedAt: input.now.toISOString(),
    });
    return Object.freeze({ accepted: true, eventId: receipt.eventId, outcome: "failed" });
  }
}

export const commercialWebhookInternals = Object.freeze({
  parseVerifiedEnvelope,
  digest: (value: string) => crypto.createHash("sha256").update(value).digest("hex"),
});
