import { Router, type Request, type Response, type NextFunction } from "express";
import { authMiddleware } from "../middlewares/auth";
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
