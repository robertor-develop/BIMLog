import { Router } from "express";
import { db } from "@workspace/db";
import { userConnectionsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";

const router: Router = Router();

// Safe projection — never leaks `credentials`.
function toSafe(c: typeof userConnectionsTable.$inferSelect) {
  return {
    provider: c.provider,
    kind: c.kind,
    status: c.status,
    accountLabel: c.accountLabel,
    lastError: c.lastError,
    connectedAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

// ── GET /me/connections — the current user's connected services (no secrets) ──
router.get("/me/connections", authMiddleware, async (req, res) => {
  try {
    const rows = await db.select().from(userConnectionsTable)
      .where(eq(userConnectionsTable.userId, req.user!.userId));
    res.json(rows.map(toSafe));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── PUT /me/connections/sendgrid — connect this user's own SendGrid account ───
// Validates the key against SendGrid before storing it. The key is stored
// server-side only and is never returned.
router.put("/me/connections/sendgrid", authMiddleware, async (req, res) => {
  const { apiKey, fromEmail } = req.body as { apiKey?: unknown; fromEmail?: unknown };
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    res.status(400).json({ error: "apiKey is required" }); return;
  }
  if (typeof fromEmail !== "string" || !fromEmail.includes("@")) {
    res.status(400).json({ error: "A valid fromEmail (verified sender) is required" }); return;
  }
  // Validate the key with a real SendGrid call.
  try {
    const check = await fetch("https://api.sendgrid.com/v3/scopes", {
      headers: { Authorization: `Bearer ${apiKey.trim()}` },
    });
    if (!check.ok) {
      res.status(400).json({ error: check.status === 401 ? "SendGrid rejected this API key" : `SendGrid validation failed (${check.status})` });
      return;
    }
  } catch (err) {
    res.status(502).json({ error: `Could not reach SendGrid: ${err instanceof Error ? err.message : "network error"}` });
    return;
  }

  try {
    const now = new Date();
    const values = {
      userId: req.user!.userId,
      provider: "sendgrid",
      kind: "email",
      status: "connected",
      credentials: { apiKey: apiKey.trim() },
      accountLabel: fromEmail.trim(),
      lastError: null as string | null,
      updatedAt: now,
    };
    await db.insert(userConnectionsTable).values(values).onConflictDoUpdate({
      target: [userConnectionsTable.userId, userConnectionsTable.provider],
      set: {
        credentials: values.credentials,
        accountLabel: values.accountLabel,
        status: "connected",
        lastError: null,
        updatedAt: now,
      },
    });
    const [row] = await db.select().from(userConnectionsTable)
      .where(and(eq(userConnectionsTable.userId, req.user!.userId), eq(userConnectionsTable.provider, "sendgrid")));
    res.json(toSafe(row));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── DELETE /me/connections/:provider — disconnect a service ───────────────────
router.delete("/me/connections/:provider", authMiddleware, async (req, res) => {
  try {
    await db.delete(userConnectionsTable)
      .where(and(eq(userConnectionsTable.userId, req.user!.userId), eq(userConnectionsTable.provider, String(req.params.provider))));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

export default router;
