import { Router, type Request, type Response, type NextFunction } from "express";
import crypto from "crypto";
import { pool } from "@workspace/db";
import { authMiddleware } from "../middlewares/auth";
import { listUsage, type Actor } from "../lib/ai-control-plane";
import {
  TelegramProductError,
  createTelegramLink,
  disconnectTelegram,
  getTelegramProductConfig,
  getTelegramStatus,
  processTelegramInboundQueue,
  receiveTelegramWebhook,
  requireTelegramProductConfig,
  setTelegramLanguage,
  telegramProductHealth,
  timingSafeEqualText,
} from "../lib/telegram-product";
import {
  cancelDeliveryRequest,
  confirmDeliveryRequest,
  createDeliveryRequest,
  executeDeliveryRequest,
  listDeliveryRequests,
  readSecureDeliveryLink,
} from "../lib/telegram-product-delivery";

const router: Router = Router();

async function actorFor(userId: number): Promise<Actor> {
  const result = await pool.query(`SELECT u.id,u.company_id,u.is_super_admin,EXISTS(SELECT 1 FROM company_ai_administrators ca WHERE ca.user_id=u.id AND ca.company_id=u.company_id AND ca.status='active') AS is_company_admin FROM users u WHERE u.id=$1`, [userId]);
  const row = result.rows[0];
  if (!row) throw new TelegramProductError(401, "AUTH_USER_MISSING", "Authenticated user no longer exists.");
  return { userId: row.id, companyId: row.company_id, isSuperAdmin: row.is_super_admin === true, isCompanyAdmin: row.is_company_admin === true };
}

function reasonText(value: unknown): string {
  return typeof value === "string" && value.trim().length >= 8 ? value.trim().slice(0, 500) : "";
}

async function auditAdminAccess(actor: Actor, action: string, targetType: string, targetId: string, reason: string, details: Record<string, unknown> = {}) {
  await pool.query(
    `INSERT INTO admin_actions_log(admin_user_id,admin_email,action,target_type,target_id,details)
     SELECT id,email,$2,$3,$4,$5::jsonb FROM users WHERE id=$1`,
    [actor.userId, action, targetType, targetId, JSON.stringify({ ...details, reason })],
  );
}

function sendTelegramError(res: Response, err: unknown): void {
  if (err instanceof TelegramProductError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }
  res.status(500).json({ error: "Internal server error" });
}

function requireTelegramWebhook(req: Request, res: Response, next: NextFunction): void {
  try {
    const config = requireTelegramProductConfig();
    if (!timingSafeEqualText(String(req.params.adapterId || ""), config.adapterId)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const headerSecret = req.get("x-telegram-bot-api-secret-token");
    if (!timingSafeEqualText(headerSecret, config.webhookSecret)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!req.is("application/json")) {
      res.status(415).json({ error: "Content-Type must be application/json" });
      return;
    }
    next();
  } catch (err) {
    sendTelegramError(res, err);
  }
}

router.get("/integrations/telegram/status", authMiddleware, async (req, res) => {
  try {
    res.json(await getTelegramStatus(req.user!.userId));
  } catch (err) {
    sendTelegramError(res, err);
  }
});

router.get("/integrations/telegram/conversations", authMiddleware, async (req, res) => {
  try {
    const actor = await actorFor(req.user!.userId);
    const conversations = await pool.query(
      `SELECT c.id,c.mode,c.status,c.language,c.ai_funding_source,c.ai_run_id,c.support_case_id,c.created_at,c.updated_at,c.last_activity_at,
        (SELECT count(*)::int FROM telegram_conversation_messages m WHERE m.conversation_id=c.id) AS message_count,
        sc.case_number,sc.subject AS support_subject,sc.severity AS support_severity,sc.status AS support_status,
        ar.provider,ar.model,ar.credit_owner_type,ar.status AS ai_status,ar.estimated_max_micros,ar.actual_micros,ar.currency
       FROM telegram_conversations c
       LEFT JOIN telegram_support_cases sc ON sc.id=c.support_case_id
       LEFT JOIN ai_runs ar ON ar.id=c.ai_run_id
       WHERE c.user_id=$1
       ORDER BY c.last_activity_at DESC
       LIMIT 25`,
      [actor.userId],
    );
    const supportCases = await pool.query(
      `SELECT id,case_number,category,subject,severity,status,language,created_at,updated_at
       FROM telegram_support_cases WHERE user_id=$1 ORDER BY created_at DESC LIMIT 25`,
      [actor.userId],
    );
    const usage = await listUsage(actor);
    res.json({ conversations: conversations.rows, supportCases: supportCases.rows, aiUsage: usage.filter((row: any) => row.capability === "assistant").slice(0, 25), deliveries: await listDeliveryRequests(actor.userId) });
  } catch (err) {
    sendTelegramError(res, err);
  }
});

router.get("/integrations/telegram/deliveries", authMiddleware, async (req, res) => {
  try {
    res.json({ deliveries: await listDeliveryRequests(req.user!.userId) });
  } catch (err) { sendTelegramError(res, err); }
});

router.post("/integrations/telegram/deliveries/preview", authMiddleware, async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    res.status(201).json(await createDeliveryRequest({
      userId: req.user!.userId,
      projectId: body.projectId,
      artifactType: body.artifactType,
      entityId: body.entityId,
      channel: body.channel,
      recipients: body.recipients,
      language: body.language === "es" ? "es" : "en",
      confirmationKey: typeof body.confirmationKey === "string" ? body.confirmationKey : `browser:${crypto.randomUUID()}`,
    }));
  } catch (err) { sendTelegramError(res, err); }
});

router.post("/integrations/telegram/deliveries/:id/confirm", authMiddleware, async (req, res) => {
  try {
    if ((req.body as { externalConfirmation?: unknown }).externalConfirmation === true) {
      throw new TelegramProductError(409, "EXTERNAL_CONFIRMATION_BYPASS_REJECTED", "Use the separate external confirmation step after the first confirmation.");
    }
    const confirmed = await confirmDeliveryRequest(req.user!.userId, String(req.params.id), false);
    if ((confirmed as { externalConfirmationRequired?: boolean }).externalConfirmationRequired) { res.status(409).json(confirmed); return; }
    const status = (confirmed as { status: string }).status;
    res.json(status === "confirmed" ? await executeDeliveryRequest(String(req.params.id)) : confirmed);
  } catch (err) { sendTelegramError(res, err); }
});

router.post("/integrations/telegram/deliveries/:id/confirm-external", authMiddleware, async (req, res) => {
  try {
    const confirmed = await confirmDeliveryRequest(req.user!.userId, String(req.params.id), true);
    res.json((confirmed as { status: string }).status === "confirmed" ? await executeDeliveryRequest(String(req.params.id)) : confirmed);
  } catch (err) { sendTelegramError(res, err); }
});

router.post("/integrations/telegram/deliveries/:id/cancel", authMiddleware, async (req, res) => {
  try { res.json(await cancelDeliveryRequest(req.user!.userId, String(req.params.id))); }
  catch (err) { sendTelegramError(res, err); }
});

router.get("/integrations/telegram/deliveries/links/:token", authMiddleware, async (req, res) => {
  try {
    const artifact = await readSecureDeliveryLink(String(req.params.token), req.user!.userId);
    const clean = artifact.fileName.replace(/[\u0000-\u001f\u007f"\\]/g, "").trim() || "BIMLog-delivery";
    res.setHeader("Content-Type", artifact.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${clean.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(clean)}`);
    res.setHeader("Content-Length", artifact.size);
    res.send(artifact.buffer);
  } catch (err) { sendTelegramError(res, err); }
});

router.get("/integrations/telegram/admin/deliveries", authMiddleware, async (req, res) => {
  try {
    const actor = await actorFor(req.user!.userId);
    if (!actor.isSuperAdmin) throw new TelegramProductError(403, "SUPER_ADMIN_REQUIRED", "Super admin access required.");
    const reason = reasonText(req.query.reason);
    if (!reason) throw new TelegramProductError(400, "REASON_REQUIRED", "A specific access reason is required.");
    const rows = await pool.query(`SELECT d.id,d.user_id,d.company_id,d.project_id,d.artifact_type,d.artifact_entity_id,d.artifact_label,d.channel,d.status,
      jsonb_array_length(d.recipient_identities) AS recipient_count,d.attempt_count,d.provider_acknowledgement_state,d.failure_category,d.artifact_sha256,d.artifact_size,d.created_at,d.updated_at,d.delivered_at
      FROM telegram_delivery_requests d ORDER BY d.created_at DESC LIMIT 100`);
    await auditAdminAccess(actor, "telegram_admin_deliveries_accessed", "telegram_delivery", "list", reason, { rowCount: rows.rowCount });
    res.json({ deliveries: rows.rows });
  } catch (err) { sendTelegramError(res, err); }
});

router.get("/integrations/telegram/admin/deliveries/:id", authMiddleware, async (req, res) => {
  try {
    const actor = await actorFor(req.user!.userId);
    if (!actor.isSuperAdmin) throw new TelegramProductError(403, "SUPER_ADMIN_REQUIRED", "Super admin access required.");
    const reason = reasonText(req.query.reason);
    if (!reason) throw new TelegramProductError(400, "REASON_REQUIRED", "A specific access reason is required.");
    const id = String(req.params.id);
    const delivery = await pool.query(`SELECT id,user_id,company_id,project_id,artifact_type,artifact_entity_id,artifact_label,channel,recipient_identities,external_recipients,language,status,
      confirmed_at,external_warning_acknowledged,external_warning_acknowledged_at,external_confirmed_at,provider_acknowledgement_state,provider_reference,attempt_count,delivered_at,failure_category,artifact_sha256,artifact_size,expires_at,created_at,updated_at
      FROM telegram_delivery_requests WHERE id=$1`, [id]);
    if (!delivery.rows[0]) throw new TelegramProductError(404, "DELIVERY_NOT_FOUND", "Delivery request not found.");
    const events = await pool.query(`SELECT id,actor_user_id,from_status,to_status,event_type,reason,safe_details,created_at FROM telegram_delivery_events WHERE delivery_id=$1 ORDER BY created_at,id`, [id]);
    const attempts = await pool.query(`SELECT id,attempt_number,channel,state,provider_reference,failure_category,started_at,completed_at FROM telegram_delivery_attempts WHERE delivery_id=$1 ORDER BY attempt_number`, [id]);
    await auditAdminAccess(actor, "telegram_admin_delivery_details_accessed", "telegram_delivery", id, reason, { eventCount: events.rowCount, attemptCount: attempts.rowCount });
    res.json({ delivery: delivery.rows[0], events: events.rows, attempts: attempts.rows });
  } catch (err) { sendTelegramError(res, err); }
});

router.get("/integrations/telegram/admin/conversations", authMiddleware, async (req, res) => {
  try {
    const actor = await actorFor(req.user!.userId);
    if (!actor.isSuperAdmin) throw new TelegramProductError(403, "SUPER_ADMIN_REQUIRED", "Super admin access required.");
    const reason = reasonText(req.query.reason);
    if (!reason) throw new TelegramProductError(400, "REASON_REQUIRED", "A specific access reason is required.");
    const rows = await pool.query(
      `SELECT c.id,c.user_id,u.email,c.company_id,c.mode,c.status,c.language,c.ai_funding_source,c.support_case_id,c.last_activity_at,
        (SELECT count(*)::int FROM telegram_conversation_messages m WHERE m.conversation_id=c.id) AS message_count
       FROM telegram_conversations c
       JOIN users u ON u.id=c.user_id
       ORDER BY c.last_activity_at DESC LIMIT 100`,
    );
    await auditAdminAccess(actor, "telegram_admin_conversations_accessed", "telegram_conversation", "list", reason, { rowCount: rows.rowCount });
    res.json({ conversations: rows.rows });
  } catch (err) {
    sendTelegramError(res, err);
  }
});

router.get("/integrations/telegram/admin/conversations/:id", authMiddleware, async (req, res) => {
  try {
    const actor = await actorFor(req.user!.userId);
    if (!actor.isSuperAdmin) throw new TelegramProductError(403, "SUPER_ADMIN_REQUIRED", "Super admin access required.");
    const reason = reasonText(req.query.reason);
    if (!reason) throw new TelegramProductError(400, "REASON_REQUIRED", "A specific access reason is required.");
    const conversationId = String(req.params.id || "");
    const conversation = await pool.query(
      `SELECT c.id,c.user_id,u.email,c.company_id,c.mode,c.status,c.language,c.ai_funding_source,c.ai_run_id,c.support_case_id,c.created_at,c.updated_at,c.last_activity_at,
        (SELECT count(*)::int FROM telegram_conversation_messages m WHERE m.conversation_id=c.id) AS message_count,
        sc.case_number,sc.subject AS support_subject,sc.severity AS support_severity,sc.status AS support_status,
        ar.provider,ar.model,ar.credit_owner_type,ar.status AS ai_status,ar.estimated_max_micros,ar.actual_micros,ar.currency
       FROM telegram_conversations c
       JOIN users u ON u.id=c.user_id
       LEFT JOIN telegram_support_cases sc ON sc.id=c.support_case_id
       LEFT JOIN ai_runs ar ON ar.id=c.ai_run_id
       WHERE c.id=$1`,
      [conversationId],
    );
    if (!conversation.rows[0]) throw new TelegramProductError(404, "CONVERSATION_NOT_FOUND", "Conversation not found.");
    const messages = await pool.query(
      `SELECT id,direction,sender_role,language,sanitized_text,processing_state,delivery_state,requested_action,delivered_summary,ai_run_id,error_category,created_at,delivered_at
       FROM telegram_conversation_messages
       WHERE conversation_id=$1
       ORDER BY created_at ASC,id ASC`,
      [conversationId],
    );
    await auditAdminAccess(actor, "telegram_admin_conversation_content_accessed", "telegram_conversation", conversationId, reason, { messageCount: messages.rowCount });
    res.json({ conversation: conversation.rows[0], messages: messages.rows });
  } catch (err) {
    sendTelegramError(res, err);
  }
});

router.get("/integrations/telegram/admin/support-queue", authMiddleware, async (req, res) => {
  try {
    const actor = await actorFor(req.user!.userId);
    if (!actor.isSuperAdmin) throw new TelegramProductError(403, "SUPER_ADMIN_REQUIRED", "Super admin access required.");
    const reason = reasonText(req.query.reason);
    if (!reason) throw new TelegramProductError(400, "REASON_REQUIRED", "A specific access reason is required.");
    const rows = await pool.query(
      `SELECT sc.id,sc.case_number,sc.user_id,u.email,sc.company_id,sc.category,sc.subject,sc.severity,sc.status,sc.language,sc.created_at,sc.updated_at
       FROM telegram_support_cases sc
       JOIN users u ON u.id=sc.user_id
       WHERE sc.status<>'closed'
       ORDER BY CASE sc.severity WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, sc.created_at ASC
       LIMIT 100`,
    );
    await auditAdminAccess(actor, "telegram_admin_support_queue_accessed", "telegram_support_case", "queue", reason, { rowCount: rows.rowCount });
    res.json({ supportCases: rows.rows });
  } catch (err) {
    sendTelegramError(res, err);
  }
});

router.patch("/integrations/telegram/admin/support-cases/:id/status", authMiddleware, async (req, res) => {
  try {
    const actor = await actorFor(req.user!.userId);
    if (!actor.isSuperAdmin) throw new TelegramProductError(403, "SUPER_ADMIN_REQUIRED", "Super admin access required.");
    const reason = reasonText((req.body as { reason?: unknown }).reason);
    if (!reason) throw new TelegramProductError(400, "REASON_REQUIRED", "A specific status-change reason is required.");
    const nextStatus = String((req.body as { status?: unknown }).status || "");
    if (!["acknowledged", "in_progress", "waiting_for_user", "resolved", "closed"].includes(nextStatus)) throw new TelegramProductError(400, "STATUS_INVALID", "Support status is invalid.");
    const current = await pool.query(`SELECT * FROM telegram_support_cases WHERE id=$1 FOR UPDATE`, [String(req.params.id)]);
    const row = current.rows[0];
    if (!row) throw new TelegramProductError(404, "SUPPORT_CASE_NOT_FOUND", "Support case not found.");
    const updated = await pool.query(`UPDATE telegram_support_cases SET status=$2, updated_at=now(), closed_at=CASE WHEN $2='closed' THEN now() ELSE closed_at END WHERE id=$1 RETURNING *`, [String(req.params.id), nextStatus]);
    await pool.query(
      `INSERT INTO telegram_support_case_events(id,case_id,actor_user_id,action,from_status,to_status,reason,details)
       VALUES($1,$2,$3,'status_changed',$4,$5,$6,$7::jsonb)`,
      [crypto.randomUUID(), String(req.params.id), actor.userId, row.status, nextStatus, reason, JSON.stringify({ source: "super_admin_route" })],
    );
    res.json(updated.rows[0]);
  } catch (err) {
    sendTelegramError(res, err);
  }
});

router.get("/integrations/telegram/health", authMiddleware, (_req, res) => {
  res.json(telegramProductHealth());
});

router.post("/integrations/telegram/link", authMiddleware, async (req, res) => {
  try {
    res.json(await createTelegramLink(req.user!.userId, req.user!.email, req.body as { consentAccepted?: unknown; consentVersion?: unknown; purpose?: unknown }));
  } catch (err) {
    sendTelegramError(res, err);
  }
});

router.patch("/integrations/telegram/language", authMiddleware, async (req, res) => {
  try {
    res.json(await setTelegramLanguage(req.user!.userId, req.user!.email, (req.body as { language?: unknown }).language));
  } catch (err) {
    sendTelegramError(res, err);
  }
});

router.delete("/integrations/telegram", authMiddleware, async (req, res) => {
  try {
    res.json(await disconnectTelegram(req.user!.userId, req.user!.email, "browser"));
  } catch (err) {
    sendTelegramError(res, err);
  }
});

router.get("/integrations/telegram/consent-version", authMiddleware, (_req, res) => {
  const config = getTelegramProductConfig();
  res.json({ configured: config.configured, consentVersion: config.consentVersion || "unconfigured" });
});

router.post("/webhooks/telegram/:adapterId", requireTelegramWebhook, async (req, res) => {
  try {
    const receipt = await receiveTelegramWebhook(req.body);
    res.json({ ok: true });
    if (!receipt.duplicate) {
      setTimeout(() => {
        processTelegramInboundQueue().catch((err) => {
          console.error("[telegram-product] durable queue processing failed:", err instanceof Error ? err.message : "unknown");
        });
      }, 0);
    }
  } catch (err) {
    sendTelegramError(res, err);
  }
});

export default router;
