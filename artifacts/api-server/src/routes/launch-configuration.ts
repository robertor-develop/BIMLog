import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { authMiddleware, isSuperAdminMiddleware } from "../middlewares/auth";
import { inspectLaunchConfiguration, type LaunchConfigurationInput } from "../lib/launch-configuration";
import { encryptLaunchSecret, maskLaunchSecret, type LaunchSecretEnvelope } from "../lib/launch-configuration-secret";
import { useLaunchSecret } from "../lib/launch-configuration-secret";
import { sendLaunchTestEmail, verifyLaunchEmailProvider, type LaunchEmailAdapters } from "../lib/launch-email-provider";
import { createLiveLaunchEmailAdapters } from "../lib/launch-email-provider-live";
import { liveSmtpLaunchProbe } from "../lib/launch-smtp-probe";
import { verifyLaunchPaymentMethod } from "../lib/launch-payment-verification";
import { LaunchConfigurationConflict, listLaunchConfigurationHistory, listLatestLaunchPaymentVerifications, readLaunchConfiguration, readLatestLaunchEmailVerification, recordLaunchEmailVerification, recordLaunchPaymentVerification, writeLaunchConfiguration, type LaunchEnvironment, type LaunchStoredState } from "../lib/launch-configuration-store";

const router: IRouter = Router();
const environments = new Set<LaunchEnvironment>(["development", "staging", "production"]);
const environment = (value: string) => environments.has(value as LaunchEnvironment) ? value as LaunchEnvironment : null;
const reason = (value: unknown) => typeof value === "string" && value.trim().length >= 8 && value.trim().length <= 500 ? value.trim() : null;

type StoredLaunchConfiguration = Omit<LaunchConfigurationInput, "emailDelivery"> & { emailDelivery: Record<string, any>; paymentProvider?: Record<string, any>; secretEnvelopes?: { smtpPassword?: LaunchSecretEnvelope; sendgridApiKey?: LaunchSecretEnvelope; stripeSecretKey?: LaunchSecretEnvelope; stripeWebhookSecret?: LaunchSecretEnvelope } };
function publicConfiguration(value: unknown) {
  const configuration = structuredClone((value ?? {}) as StoredLaunchConfiguration) as any;
  const envelopes = configuration.secretEnvelopes;
  delete configuration.secretEnvelopes;
  if (configuration.emailDelivery) configuration.emailDelivery = { ...configuration.emailDelivery, smtpPasswordSecretReference: undefined, sendgridApiKeySecretReference: undefined };
  if (configuration.paymentProvider) configuration.paymentProvider = { ...configuration.paymentProvider, secretKeyReference: undefined, webhookSecretReference: undefined };
  return { ...configuration, secrets: { smtpPassword: maskLaunchSecret(envelopes?.smtpPassword), sendgridApiKey: maskLaunchSecret(envelopes?.sendgridApiKey), stripeSecretKey: maskLaunchSecret(envelopes?.stripeSecretKey), stripeWebhookSecret: maskLaunchSecret(envelopes?.stripeWebhookSecret) } };
}
const response = (record: any) => record ? { ...record, configuration: publicConfiguration(record.configuration) } : null;
const emailAdapters: LaunchEmailAdapters = createLiveLaunchEmailAdapters({ smtp: liveSmtpLaunchProbe });
const recipient = (value: unknown) => typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) && value.trim().length <= 254 ? value.trim().toLowerCase() : null;

export async function executeLaunchEmailCheck(input: { record: { configuration: unknown }; environment: LaunchEnvironment; action: "verify" | "send-test"; recipient?: string; adapters?: LaunchEmailAdapters }) {
  const stored = input.record.configuration as StoredLaunchConfiguration;
  const provider = stored.emailDelivery?.provider;
  const field = provider === "sendgrid" ? "sendgridApiKey" : "smtpPassword";
  const envelope = stored.secretEnvelopes?.[field];
  return useLaunchSecret({ environment: input.environment, field, envelope }, secret => input.action === "verify"
    ? verifyLaunchEmailProvider({ configuration: stored.emailDelivery, secret, adapters: input.adapters ?? emailAdapters })
    : sendLaunchTestEmail({ configuration: stored.emailDelivery, secret, recipient: input.recipient ?? "", adapters: input.adapters ?? emailAdapters }));
}

router.get("/admin/launch-configuration/:environment", authMiddleware, isSuperAdminMiddleware, async (req, res) => {
  const target = environment(String(req.params.environment)); if (!target) { res.status(400).json({ code: "LAUNCH_ENVIRONMENT_INVALID" }); return; }
  res.set("Cache-Control", "private, no-store, max-age=0"); res.json({ item: response(await readLaunchConfiguration(pool, target)), emailVerification: await readLatestLaunchEmailVerification(pool, target), paymentVerifications: await listLatestLaunchPaymentVerifications(pool, target) });
});

router.get("/admin/launch-configuration/:environment/history", authMiddleware, isSuperAdminMiddleware, async (req, res) => {
  const target = environment(String(req.params.environment)); if (!target) { res.status(400).json({ code: "LAUNCH_ENVIRONMENT_INVALID" }); return; }
  res.set("Cache-Control", "private, no-store, max-age=0"); res.json({ items: await listLaunchConfigurationHistory(pool, target) });
});

router.put("/admin/launch-configuration/:environment", authMiddleware, isSuperAdminMiddleware, async (req, res) => {
  const target = environment(String(req.params.environment)), changeReason = reason(req.body?.reason), expectedRevision = Number(req.body?.expectedRevision);
  if (!target || !changeReason || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || !req.body?.configuration) { res.status(400).json({ code: "LAUNCH_CONFIGURATION_INVALID" }); return; }
  const supplied = structuredClone(req.body.configuration) as any as StoredLaunchConfiguration & { emailDelivery: Record<string, unknown> }, previous = await readLaunchConfiguration(pool, target), prior = previous?.configuration as StoredLaunchConfiguration | undefined;
  supplied.secretEnvelopes = { ...prior?.secretEnvelopes };
  const smtpPassword = req.body?.secrets?.smtpPassword, sendgridApiKey = req.body?.secrets?.sendgridApiKey;
  const stripeSecretKey = req.body?.secrets?.stripeSecretKey, stripeWebhookSecret = req.body?.secrets?.stripeWebhookSecret;
  if (typeof smtpPassword === "string" && smtpPassword.trim()) supplied.secretEnvelopes.smtpPassword = encryptLaunchSecret({ environment: target, field: "smtpPassword", value: smtpPassword });
  if (typeof sendgridApiKey === "string" && sendgridApiKey.trim()) supplied.secretEnvelopes.sendgridApiKey = encryptLaunchSecret({ environment: target, field: "sendgridApiKey", value: sendgridApiKey });
  if (typeof stripeSecretKey === "string" && stripeSecretKey.trim()) supplied.secretEnvelopes.stripeSecretKey = encryptLaunchSecret({ environment: target, field: "stripeSecretKey", value: stripeSecretKey });
  if (typeof stripeWebhookSecret === "string" && stripeWebhookSecret.trim()) supplied.secretEnvelopes.stripeWebhookSecret = encryptLaunchSecret({ environment: target, field: "stripeWebhookSecret", value: stripeWebhookSecret });
  supplied.emailDelivery = { ...supplied.emailDelivery, smtpPasswordSecretReference: supplied.secretEnvelopes.smtpPassword ? "encrypted:v1" : undefined, sendgridApiKeySecretReference: supplied.secretEnvelopes.sendgridApiKey ? "encrypted:v1" : undefined };
  supplied.paymentProvider = { ...supplied.paymentProvider, secretKeyReference: supplied.secretEnvelopes.stripeSecretKey ? "encrypted:v1" : undefined, webhookSecretReference: supplied.secretEnvelopes.stripeWebhookSecret ? "encrypted:v1" : undefined };
  const readiness = inspectLaunchConfiguration(supplied), state: LaunchStoredState = readiness.launchConfigurationEntered ? "validated" : "draft";
  try {
    const item = await writeLaunchConfiguration(pool, { environment: target, expectedRevision, state, configuration: supplied, readiness, actorUserId: req.user!.userId, reason: changeReason });
    res.set("Cache-Control", "private, no-store, max-age=0"); res.json({ item: response(item) });
  } catch (error) { if (error instanceof LaunchConfigurationConflict) { res.status(409).json({ code: "LAUNCH_CONFIGURATION_STALE" }); return; } throw error; }
});

router.post("/admin/launch-configuration/:environment/email/verify", authMiddleware, isSuperAdminMiddleware, async (req, res) => {
  const target = environment(String(req.params.environment)); if (!target) { res.status(400).json({ code: "LAUNCH_ENVIRONMENT_INVALID" }); return; }
  const current = await readLaunchConfiguration(pool, target); if (!current) { res.status(404).json({ code: "LAUNCH_CONFIGURATION_NOT_FOUND" }); return; }
  const result = await executeLaunchEmailCheck({ record: current, environment: target, action: "verify" });
  await recordLaunchEmailVerification(pool, { configurationId: current.id, environment: target, revision: current.revision, provider: result.provider, action: "verify", status: result.status, resultCode: result.code, actorUserId: req.user!.userId });
  res.set("Cache-Control", "private, no-store, max-age=0"); res.status(result.status === "verified" ? 200 : 409).json({ result });
});

router.post("/admin/launch-configuration/:environment/email/send-test", authMiddleware, isSuperAdminMiddleware, async (req, res) => {
  const target = environment(String(req.params.environment)), to = recipient(req.body?.recipient);
  if (!target || !to) { res.status(400).json({ code: "LAUNCH_EMAIL_TEST_INVALID" }); return; }
  const current = await readLaunchConfiguration(pool, target); if (!current) { res.status(404).json({ code: "LAUNCH_CONFIGURATION_NOT_FOUND" }); return; }
  const result = await executeLaunchEmailCheck({ record: current, environment: target, action: "send-test", recipient: to });
  await recordLaunchEmailVerification(pool, { configurationId: current.id, environment: target, revision: current.revision, provider: result.provider, action: "send_test", status: result.status, resultCode: result.code, actorUserId: req.user!.userId });
  res.set("Cache-Control", "private, no-store, max-age=0"); res.status(result.status === "sent" ? 200 : 409).json({ result });
});

router.post("/admin/launch-configuration/:environment/payment/verify", authMiddleware, isSuperAdminMiddleware, async (req, res) => {
  const target = environment(String(req.params.environment)), method = String(req.body?.method);
  if (!target || !["bank_transfer", "qr_payment", "stripe"].includes(method)) { res.status(400).json({ code: "LAUNCH_PAYMENT_TEST_INVALID" }); return; }
  const current = await readLaunchConfiguration(pool, target); if (!current) { res.status(404).json({ code: "LAUNCH_CONFIGURATION_NOT_FOUND" }); return; }
  const stored = current.configuration as StoredLaunchConfiguration, readiness = current.readiness as any;
  if (!(stored.enabledPaymentMethods ?? []).includes(method)) { res.status(409).json({ code: "LAUNCH_PAYMENT_METHOD_DISABLED" }); return; }
  const payment = readiness.paymentMethods?.capabilities?.find((item: any) => item.method === method);
  let result;
  if (method === "stripe") {
    const mode = stored.paymentProvider?.mode === "production" ? "production" : "sandbox";
    result = useLaunchSecret({ environment: target, field: "stripeSecretKey", envelope: stored.secretEnvelopes?.stripeSecretKey }, secretKey => useLaunchSecret({ environment: target, field: "stripeWebhookSecret", envelope: stored.secretEnvelopes?.stripeWebhookSecret }, webhookSecret => verifyLaunchPaymentMethod({ method: "stripe", mode, configurationReady: payment?.issues?.length === 0, accountReference: stored.paymentProvider?.accountReference, secretKey, webhookSecret })));
  } else result = verifyLaunchPaymentMethod({ method: method as "bank_transfer" | "qr_payment", configurationReady: payment?.issues?.length === 0 });
  const resolved = await result;
  await recordLaunchPaymentVerification(pool, { configurationId: current.id, environment: target, revision: current.revision, method: resolved.method, mode: resolved.mode, status: resolved.status, resultCode: resolved.code, actorUserId: req.user!.userId });
  res.set("Cache-Control", "private, no-store, max-age=0"); res.status(["configured", "verified"].includes(resolved.status) ? 200 : 409).json({ result: resolved });
});

router.post("/admin/launch-configuration/:environment/:action", authMiddleware, isSuperAdminMiddleware, async (req, res) => {
  const target = environment(String(req.params.environment)), action = String(req.params.action), changeReason = reason(req.body?.reason), expectedRevision = Number(req.body?.expectedRevision);
  if (!target || !["activate", "deactivate"].includes(action) || !changeReason || !Number.isSafeInteger(expectedRevision)) { res.status(400).json({ code: "LAUNCH_CONFIGURATION_ACTION_INVALID" }); return; }
  const current = await readLaunchConfiguration(pool, target); if (!current) { res.status(404).json({ code: "LAUNCH_CONFIGURATION_NOT_FOUND" }); return; }
  if (action === "activate" && !(current.readiness as any)?.launchConfigurationEntered) { res.status(409).json({ code: "LAUNCH_CONFIGURATION_NOT_READY" }); return; }
  if (action === "activate" && target === "production") {
    const evidence = await readLatestLaunchEmailVerification(pool, target), provider = (current.configuration as StoredLaunchConfiguration).emailDelivery?.provider;
    if (!evidence || evidence.provider !== provider || !["verified", "sent"].includes(evidence.status)) { res.status(409).json({ code: "LAUNCH_EMAIL_NOT_VERIFIED" }); return; }
  }
  try {
    const state = action === "activate" ? "active" : "inactive", item = await writeLaunchConfiguration(pool, { environment: target, expectedRevision, state, configuration: current.configuration, readiness: current.readiness, actorUserId: req.user!.userId, reason: changeReason, action: action === "activate" ? "activated" : "deactivated" });
    res.set("Cache-Control", "private, no-store, max-age=0"); res.json({ item: response(item) });
  } catch (error) { if (error instanceof LaunchConfigurationConflict) { res.status(409).json({ code: "LAUNCH_CONFIGURATION_STALE" }); return; } throw error; }
});

export default router;
