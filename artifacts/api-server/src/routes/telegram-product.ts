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
    res.json({ conversations: conversations.rows, supportCases: supportCases.rows, aiUsage: usage.filter((row: any) => row.capability === "assistant").slice(0, 25) });
  } catch (err) {
    sendTelegramError(res, err);
  }
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
