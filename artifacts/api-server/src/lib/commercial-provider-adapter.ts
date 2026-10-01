import crypto from "node:crypto";

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
