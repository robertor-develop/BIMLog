import crypto from "node:crypto";
import type { BillingPortalSession, CheckoutAttempt, CommercialOrder, ProviderCustomerBinding, ProviderEventReceipt } from "./subscription-authority";

export type CommercialProviderReadiness = Readonly<{
  provider: "stripe";
  mode: "test" | "live";
  configured: boolean;
  webhookConfigured: boolean;
  portalConfigured: boolean;
  appOrigin: string;
  apiVersion: string;
  missing: readonly string[];
  fingerprint: string;
}>;

export type StripeCommercialConfiguration = Readonly<{
  secretKey: string;
  webhookSecret: string;
  portalConfigurationId: string | null;
  appOrigin: string;
  apiVersion: string;
}>;

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizedOrigin(value: string): string {
  const url = new URL(value.trim());
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("Commercial provider app origin must use HTTPS");
  }
  if (url.pathname !== "/" || url.search || url.hash || url.username || url.password) throw new Error("Commercial provider app origin must not contain a path or credentials");
  return url.origin;
}

export function inspectStripeCommercialConfiguration(input: {
  secretKey?: string;
  webhookSecret?: string;
  portalConfigurationId?: string;
  appOrigin: string;
  apiVersion?: string;
}): Readonly<{ readiness: CommercialProviderReadiness; configuration: StripeCommercialConfiguration | null }> {
  const secretKey = input.secretKey?.trim() ?? "";
  const webhookSecret = input.webhookSecret?.trim() ?? "";
  const portalConfigurationId = input.portalConfigurationId?.trim() || null;
  const appOrigin = normalizedOrigin(input.appOrigin);
  const apiVersion = input.apiVersion?.trim() || "2025-02-24.acacia";
  const mode = secretKey.startsWith("sk_live_") ? "live" : "test";
  const missing = Object.freeze([
    ...(!/^sk_(test|live)_[A-Za-z0-9_]{12,}$/.test(secretKey) ? ["secret_key"] : []),
    ...(!/^whsec_[A-Za-z0-9_]{12,}$/.test(webhookSecret) ? ["webhook_secret"] : []),
  ]);
  const configured = missing.length === 0;
  const readiness = Object.freeze({
    provider: "stripe" as const, mode, configured,
    webhookConfigured: !missing.includes("webhook_secret"), portalConfigured: portalConfigurationId !== null,
    appOrigin, apiVersion, missing,
    fingerprint: sha256(JSON.stringify({ provider: "stripe", mode, configured, portalConfigured: portalConfigurationId !== null, appOrigin, apiVersion })),
  });
  return Object.freeze({
    readiness,
    configuration: configured ? Object.freeze({ secretKey, webhookSecret, portalConfigurationId, appOrigin, apiVersion }) : null,
  });
}

export type StripeTransport = (request: Readonly<{
  method: "POST";
  path: string;
  headers: Readonly<Record<string, string>>;
  body: URLSearchParams;
}>) => Promise<Readonly<{ status: number; body: unknown }>>;

export function createStripeTransport(input: {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxResponseBytes?: number;
} = {}): StripeTransport {
  const fetchImpl = input.fetchImpl ?? fetch;
  const timeoutMs = input.timeoutMs ?? 10_000;
  const maxResponseBytes = input.maxResponseBytes ?? 1_048_576;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 30_000) throw new Error("Stripe transport timeout must be between 1000 and 30000 milliseconds");
  if (!Number.isSafeInteger(maxResponseBytes) || maxResponseBytes < 1_024 || maxResponseBytes > 2_097_152) throw new Error("Stripe transport response limit is invalid");
  return async (request) => {
    if (!request.path.startsWith("/v1/") || request.path.includes("..")) throw new Error("Stripe transport path is invalid");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`https://api.stripe.com${request.path}`, {
        method: request.method, headers: { ...request.headers, "Content-Type": "application/x-www-form-urlencoded" },
        body: request.body.toString(), signal: controller.signal,
      });
      const contentLength = Number(response.headers.get("content-length") ?? "0");
      if (Number.isFinite(contentLength) && contentLength > maxResponseBytes) throw new Error("Stripe response exceeds the configured size limit");
      const text = await response.text();
      if (Buffer.byteLength(text, "utf8") > maxResponseBytes) throw new Error("Stripe response exceeds the configured size limit");
      let body: unknown = null;
      if (text) {
        try { body = JSON.parse(text); } catch { throw new Error("Stripe returned an invalid JSON response"); }
      }
      return Object.freeze({ status: response.status, body });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw new Error("Stripe request timed out");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  };
}

function safeHostedUrl(value: unknown, expectedHost: string): string {
  if (typeof value !== "string") throw new Error("Commercial provider response is missing a hosted URL");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== expectedHost) throw new Error("Commercial provider returned an untrusted hosted URL");
  return url.toString();
}

export async function createStripeCustomer(input:{
  configuration:StripeCommercialConfiguration;
  companyId:number;
  companyName:string;
  billingEmail:string;
  idempotencyKey:string;
  transport:StripeTransport;
}):Promise<Readonly<{providerCustomerReference:string}>>{
  const companyName=input.companyName.trim(),billingEmail=input.billingEmail.trim().toLowerCase(),idempotencyKey=input.idempotencyKey.trim();
  if(!Number.isSafeInteger(input.companyId)||input.companyId<1||companyName.length<2||companyName.length>160)throw new Error("Stripe customer company identity is invalid");
  if(!/^\S+@\S+\.\S+$/.test(billingEmail)||billingEmail.length>320)throw new Error("Stripe customer billing email is invalid");
  if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/.test(idempotencyKey))throw new Error("Stripe customer request identity is invalid");
  const body=new URLSearchParams();body.set("name",companyName);body.set("email",billingEmail);body.set("metadata[company_id]",String(input.companyId));body.set("metadata[source]","bimlog");
  const response=await input.transport({method:"POST",path:"/v1/customers",body,headers:Object.freeze({Authorization:`Bearer ${input.configuration.secretKey}`,"Stripe-Version":input.configuration.apiVersion,"Idempotency-Key":idempotencyKey})});
  if(response.status<200||response.status>=300||!response.body||typeof response.body!=="object")throw new Error("Stripe customer creation failed");
  const customer=response.body as {id?:unknown;metadata?:Record<string,unknown>};
  if(typeof customer.id!=="string"||!/^cus_[A-Za-z0-9_]{6,}$/.test(customer.id)||customer.metadata?.company_id!==String(input.companyId))throw new Error("Stripe customer response identity is invalid");
  return Object.freeze({providerCustomerReference:customer.id});
}

export async function createStripeCheckoutSession(input: {
  configuration: StripeCommercialConfiguration;
  order: CommercialOrder;
  attempt: CheckoutAttempt;
  customer: ProviderCustomerBinding;
  priceReference: string;
  transport: StripeTransport;
}): Promise<Readonly<{ providerSessionId: string; checkoutUrl: string; expiresAt: string }>> {
  if (input.order.status !== "submitted" || input.attempt.status !== "created") throw new Error("Stripe checkout requires a submitted order and created attempt");
  if (input.attempt.orderId !== input.order.id || input.customer.companyId !== input.order.companyId || input.attempt.provider !== "stripe" || input.customer.provider !== "stripe") throw new Error("Stripe checkout lineage is invalid");
  const priceReference = input.priceReference.trim();
  if (!/^price_[A-Za-z0-9_]{6,}$/.test(priceReference)) throw new Error("A valid Stripe price reference is required");
  const body = new URLSearchParams();
  body.set("mode", "subscription");
  body.set("customer", input.customer.providerCustomerReference);
  body.set("client_reference_id", input.order.id);
  body.set("line_items[0][price]", priceReference);
  body.set("line_items[0][quantity]", "1");
  body.set("success_url", `${input.configuration.appOrigin}/settings/billing-support?checkout=success&session_id={CHECKOUT_SESSION_ID}`);
  body.set("cancel_url", `${input.configuration.appOrigin}/settings/billing-support?checkout=cancelled`);
  body.set("metadata[order_id]", input.order.id);
  body.set("metadata[subscription_id]", input.order.subscriptionId);
  body.set("metadata[company_id]", String(input.order.companyId));
  const response = await input.transport({
    method: "POST", path: "/v1/checkout/sessions", body,
    headers: Object.freeze({ Authorization: `Bearer ${input.configuration.secretKey}`, "Stripe-Version": input.configuration.apiVersion, "Idempotency-Key": input.attempt.idempotencyKey }),
  });
  if (response.status < 200 || response.status >= 300 || !response.body || typeof response.body !== "object") throw new Error("Stripe checkout session creation failed");
  const result = response.body as { id?: unknown; url?: unknown; expires_at?: unknown };
  if (typeof result.id !== "string" || !result.id.startsWith("cs_")) throw new Error("Stripe checkout response identity is invalid");
  if (!Number.isSafeInteger(result.expires_at)) throw new Error("Stripe checkout response expiry is invalid");
  return Object.freeze({ providerSessionId: result.id, checkoutUrl: safeHostedUrl(result.url, "checkout.stripe.com"), expiresAt: new Date((result.expires_at as number) * 1000).toISOString() });
}

export function verifyStripeWebhook(input: {
  rawPayload: string;
  signatureHeader: string;
  webhookSecret: string;
  nowEpochSeconds: number;
  priorReceipts: readonly ProviderEventReceipt[];
  toleranceSeconds?: number;
}): ProviderEventReceipt {
  const parts = input.signatureHeader.split(",").map((part) => part.trim().split("=", 2));
  const timestampText = parts.find(([key]) => key === "t")?.[1] ?? "";
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value).filter(Boolean);
  const timestamp = Number(timestampText);
  const toleranceSeconds = input.toleranceSeconds ?? 300;
  if (!Number.isSafeInteger(timestamp) || !Number.isSafeInteger(toleranceSeconds) || toleranceSeconds < 1 || toleranceSeconds > 900 || Math.abs(input.nowEpochSeconds - timestamp) > toleranceSeconds) {
    throw new Error("Stripe webhook timestamp is outside the replay window");
  }
  if (!input.webhookSecret.startsWith("whsec_") || signatures.length === 0) throw new Error("Stripe webhook signature is invalid");
  const expected = crypto.createHmac("sha256", input.webhookSecret).update(`${timestamp}.${input.rawPayload}`).digest();
  const verified = signatures.some((signature) => {
    if (!/^[0-9a-f]{64}$/i.test(signature)) return false;
    const supplied = Buffer.from(signature, "hex");
    return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
  });
  if (!verified) throw new Error("Stripe webhook signature is invalid");
  let event: { id?: unknown; type?: unknown };
  try { event = JSON.parse(input.rawPayload) as { id?: unknown; type?: unknown }; } catch { throw new Error("Stripe webhook payload is invalid JSON"); }
  if (typeof event.id !== "string" || !event.id.startsWith("evt_") || typeof event.type !== "string" || !event.type.trim()) throw new Error("Stripe webhook event identity is invalid");
  if (input.priorReceipts.some((receipt) => receipt.provider === "stripe" && receipt.eventId === event.id)) throw new Error("Stripe webhook event was already received");
  return Object.freeze({
    provider: "stripe", eventId: event.id, eventType: event.type,
    payloadDigest: sha256(input.rawPayload), receivedAt: new Date(input.nowEpochSeconds * 1000).toISOString(),
  });
}

export async function createStripeBillingPortalLaunch(input: {
  configuration: StripeCommercialConfiguration;
  session: BillingPortalSession;
  customer: ProviderCustomerBinding;
  transport: StripeTransport;
}): Promise<Readonly<{ providerSessionId: string; portalUrl: string }>> {
  if (input.session.status !== "ready" || input.customer.status !== "active") throw new Error("Stripe billing portal requires ready internal and provider customer sessions");
  if (input.session.companyId !== input.customer.companyId || input.session.providerCustomerBindingId !== input.customer.id || input.customer.provider !== "stripe") throw new Error("Stripe billing portal lineage is invalid");
  const body = new URLSearchParams();
  body.set("customer", input.customer.providerCustomerReference);
  body.set("return_url", `${input.configuration.appOrigin}${input.session.returnPath}`);
  if (input.configuration.portalConfigurationId) body.set("configuration", input.configuration.portalConfigurationId);
  const response = await input.transport({
    method: "POST", path: "/v1/billing_portal/sessions", body,
    headers: Object.freeze({ Authorization: `Bearer ${input.configuration.secretKey}`, "Stripe-Version": input.configuration.apiVersion, "Idempotency-Key": input.session.id }),
  });
  if (response.status < 200 || response.status >= 300 || !response.body || typeof response.body !== "object") throw new Error("Stripe billing portal session creation failed");
  const result = response.body as { id?: unknown; url?: unknown; customer?: unknown };
  if (typeof result.id !== "string" || !result.id.startsWith("bps_") || result.customer !== input.customer.providerCustomerReference) throw new Error("Stripe billing portal response identity is invalid");
  return Object.freeze({ providerSessionId: result.id, portalUrl: safeHostedUrl(result.url, "billing.stripe.com") });
}
