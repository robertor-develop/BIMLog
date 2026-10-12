import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { authMiddleware, isSuperAdminMiddleware } from "../middlewares/auth";
import { inspectLaunchConfiguration, type LaunchConfigurationInput } from "../lib/launch-configuration";
import { encryptLaunchSecret, maskLaunchSecret, type LaunchSecretEnvelope } from "../lib/launch-configuration-secret";
import { LaunchConfigurationConflict, listLaunchConfigurationHistory, readLaunchConfiguration, writeLaunchConfiguration, type LaunchEnvironment, type LaunchStoredState } from "../lib/launch-configuration-store";

const router: IRouter = Router();
const environments = new Set<LaunchEnvironment>(["development", "staging", "production"]);
const environment = (value: string) => environments.has(value as LaunchEnvironment) ? value as LaunchEnvironment : null;
const reason = (value: unknown) => typeof value === "string" && value.trim().length >= 8 && value.trim().length <= 500 ? value.trim() : null;

type StoredLaunchConfiguration = LaunchConfigurationInput & { secretEnvelopes?: { smtpPassword?: LaunchSecretEnvelope; sendgridApiKey?: LaunchSecretEnvelope } };
function publicConfiguration(value: unknown) {
  const configuration = structuredClone((value ?? {}) as StoredLaunchConfiguration);
  const envelopes = configuration.secretEnvelopes;
  delete configuration.secretEnvelopes;
  if (configuration.emailDelivery) configuration.emailDelivery = { ...configuration.emailDelivery, smtpPasswordSecretReference: undefined, sendgridApiKeySecretReference: undefined };
  return { ...configuration, secrets: { smtpPassword: maskLaunchSecret(envelopes?.smtpPassword), sendgridApiKey: maskLaunchSecret(envelopes?.sendgridApiKey) } };
}
const response = (record: any) => record ? { ...record, configuration: publicConfiguration(record.configuration) } : null;

router.get("/admin/launch-configuration/:environment", authMiddleware, isSuperAdminMiddleware, async (req, res) => {
  const target = environment(req.params.environment); if (!target) { res.status(400).json({ code: "LAUNCH_ENVIRONMENT_INVALID" }); return; }
  res.set("Cache-Control", "private, no-store, max-age=0"); res.json({ item: response(await readLaunchConfiguration(pool, target)) });
});

router.get("/admin/launch-configuration/:environment/history", authMiddleware, isSuperAdminMiddleware, async (req, res) => {
  const target = environment(req.params.environment); if (!target) { res.status(400).json({ code: "LAUNCH_ENVIRONMENT_INVALID" }); return; }
  res.set("Cache-Control", "private, no-store, max-age=0"); res.json({ items: await listLaunchConfigurationHistory(pool, target) });
});

router.put("/admin/launch-configuration/:environment", authMiddleware, isSuperAdminMiddleware, async (req, res) => {
  const target = environment(req.params.environment), changeReason = reason(req.body?.reason), expectedRevision = Number(req.body?.expectedRevision);
  if (!target || !changeReason || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || !req.body?.configuration) { res.status(400).json({ code: "LAUNCH_CONFIGURATION_INVALID" }); return; }
  const supplied = structuredClone(req.body.configuration) as StoredLaunchConfiguration, previous = await readLaunchConfiguration(pool, target), prior = previous?.configuration as StoredLaunchConfiguration | undefined;
  supplied.secretEnvelopes = { ...prior?.secretEnvelopes };
  const smtpPassword = req.body?.secrets?.smtpPassword, sendgridApiKey = req.body?.secrets?.sendgridApiKey;
  if (typeof smtpPassword === "string" && smtpPassword.trim()) supplied.secretEnvelopes.smtpPassword = encryptLaunchSecret({ environment: target, field: "smtpPassword", value: smtpPassword });
  if (typeof sendgridApiKey === "string" && sendgridApiKey.trim()) supplied.secretEnvelopes.sendgridApiKey = encryptLaunchSecret({ environment: target, field: "sendgridApiKey", value: sendgridApiKey });
  supplied.emailDelivery = { ...supplied.emailDelivery, smtpPasswordSecretReference: supplied.secretEnvelopes.smtpPassword ? "encrypted:v1" : undefined, sendgridApiKeySecretReference: supplied.secretEnvelopes.sendgridApiKey ? "encrypted:v1" : undefined };
  const readiness = inspectLaunchConfiguration(supplied), state: LaunchStoredState = readiness.launchConfigurationEntered ? "validated" : "draft";
  try {
    const item = await writeLaunchConfiguration(pool, { environment: target, expectedRevision, state, configuration: supplied, readiness, actorUserId: req.user!.userId, reason: changeReason });
    res.set("Cache-Control", "private, no-store, max-age=0"); res.json({ item: response(item) });
  } catch (error) { if (error instanceof LaunchConfigurationConflict) { res.status(409).json({ code: "LAUNCH_CONFIGURATION_STALE" }); return; } throw error; }
});

router.post("/admin/launch-configuration/:environment/:action", authMiddleware, isSuperAdminMiddleware, async (req, res) => {
  const target = environment(req.params.environment), action = req.params.action, changeReason = reason(req.body?.reason), expectedRevision = Number(req.body?.expectedRevision);
  if (!target || !["activate", "deactivate"].includes(action) || !changeReason || !Number.isSafeInteger(expectedRevision)) { res.status(400).json({ code: "LAUNCH_CONFIGURATION_ACTION_INVALID" }); return; }
  const current = await readLaunchConfiguration(pool, target); if (!current) { res.status(404).json({ code: "LAUNCH_CONFIGURATION_NOT_FOUND" }); return; }
  if (action === "activate" && !(current.readiness as any)?.launchConfigurationEntered) { res.status(409).json({ code: "LAUNCH_CONFIGURATION_NOT_READY" }); return; }
  try {
    const state = action === "activate" ? "active" : "inactive", item = await writeLaunchConfiguration(pool, { environment: target, expectedRevision, state, configuration: current.configuration, readiness: current.readiness, actorUserId: req.user!.userId, reason: changeReason, action: action === "activate" ? "activated" : "deactivated" });
    res.set("Cache-Control", "private, no-store, max-age=0"); res.json({ item: response(item) });
  } catch (error) { if (error instanceof LaunchConfigurationConflict) { res.status(409).json({ code: "LAUNCH_CONFIGURATION_STALE" }); return; } throw error; }
});

export default router;
