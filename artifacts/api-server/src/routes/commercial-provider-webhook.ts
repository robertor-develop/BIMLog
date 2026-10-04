import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { acceptPersistentStripeWebhook } from "../lib/commercial-provider-webhook";

const router: IRouter = Router();

function statusForCommercialWebhookError(code: string): number {
  if (code === "COMMERCIAL_WEBHOOK_NOT_CONFIGURED" || code === "COMMERCIAL_WEBHOOK_BINDING_UNAVAILABLE") return 503;
  if (code === "COMMERCIAL_WEBHOOK_PAYLOAD_INVALID") return 413;
  return 400;
}

router.post("/commercial/providers/stripe/webhook", async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const signature = req.header("stripe-signature");
    if (!signature) {
      res.status(400).json({ code: "COMMERCIAL_WEBHOOK_SIGNATURE_MISSING", error: "Stripe signature is required." });
      return;
    }
    const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody ?? (Buffer.isBuffer(req.body) ? req.body : undefined);
    if (!rawBody) {
      res.status(400).json({ code: "COMMERCIAL_WEBHOOK_RAW_BODY_MISSING", error: "Exact webhook payload is required." });
      return;
    }
    const result = await acceptPersistentStripeWebhook({
      client: pool,
      environment: process.env,
      rawPayload: rawBody.toString("utf8"),
      signatureHeader: signature,
      now: new Date(),
    });
    res.status(200).json({ received: true, eventId: result.eventId, outcome: result.outcome });
  } catch (error) {
    const code = error instanceof Error && /^COMMERCIAL_[A-Z0-9_]+$/.test(error.message)
      ? error.message
      : "COMMERCIAL_WEBHOOK_REJECTED";
    res.status(statusForCommercialWebhookError(code)).json({ code, error: "Commercial webhook was not accepted." });
  }
});

export const commercialProviderWebhookInternals = Object.freeze({ statusForCommercialWebhookError });
export default router;
