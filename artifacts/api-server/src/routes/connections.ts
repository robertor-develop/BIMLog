import { Router } from "express";
import { db } from "@workspace/db";
import { userConnectionsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { authMiddleware, signOAuthState, verifyOAuthState } from "../middlewares/auth";
import { getAppUrl } from "../lib/email";
import { browseCloud } from "../lib/cloud-files";
import { OAUTH_PROVIDERS, providerFromParam, redirectUriFor, providerConfigured, buildAuthorizeUrl, exchangeCodeForTokens, getValidAccessToken } from "../lib/oauth";
import { getAiUsageSummary, sendAiUsageError } from "../lib/ai-usage";

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

router.get("/me/ai-usage", authMiddleware, async (req, res) => {
  try {
    res.json(await getAiUsageSummary(req.user!.userId));
  } catch (err) {
    if (sendAiUsageError(res, err)) return;
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

// ── PUT /me/connections/anthropic — connect this user's own AI provider ──────
router.put("/me/connections/anthropic", authMiddleware, async (req, res) => {
  res.status(410).json({ error: "LEGACY_AI_CONNECTION_RETIRED", message: "Use /api/v1/ai-control/provider-connections. Existing legacy records are preserved but no new plaintext AI keys are accepted." });
});

// ── OAuth self-service connect (generic, one engine for every provider) ───────
// The platform registers ONE app per provider (client id/secret in server env);
// every user connects their OWN account through the flow below.

// Step 1: authenticated user asks for the consent URL to open.
router.get("/me/connections/:provider/authorize", authMiddleware, (req, res) => {
  const providerParam = String(req.params.provider);
  const key = providerFromParam(providerParam);
  if (!key) { res.status(404).json({ error: "Unknown provider" }); return; }
  if (!providerConfigured(key)) {
    res.status(503).json({ error: `${OAUTH_PROVIDERS[key].label} is not enabled on this BIMLog yet — the platform app is not configured.`, code: "PROVIDER_NOT_CONFIGURED" });
    return;
  }
  const state = signOAuthState(req.user!.userId, key);
  res.json({ url: buildAuthorizeUrl(key, state, redirectUriFor(providerParam)) });
});

// Step 2: the provider redirects the browser back here with ?code&state (no JWT
// header — identity comes from the signed state). Exchange the code, store tokens.
router.get("/connections/:provider/callback", async (req, res) => {
  const appUrl = getAppUrl();
  const providerParam = String(req.params.provider);
  const fail = (msg: string) => res.redirect(`${appUrl}/profile?connect_error=${encodeURIComponent(msg)}`);
  const key = providerFromParam(providerParam);
  if (!key) return fail("Unknown provider");
  try {
    const code = String(req.query.code || "");
    const state = String(req.query.state || "");
    if (!code || !state) return fail("Missing authorization code");
    let payload: { userId: number; provider: string; scope: string };
    try { payload = verifyOAuthState(state); } catch { return fail("Invalid or expired connect link"); }
    if (payload.scope !== "oauth_state" || payload.provider !== key) return fail("Invalid connect state");
    if (!providerConfigured(key)) return fail("Provider not configured");

    const tok = await exchangeCodeForTokens(key, code, redirectUriFor(providerParam));
    if (!tok.access_token) return fail("No access token returned");

    // Refresh token often comes back only on first consent — keep the old one if absent.
    const [existing] = await db.select().from(userConnectionsTable)
      .where(and(eq(userConnectionsTable.userId, payload.userId), eq(userConnectionsTable.provider, key)));
    const refreshToken = tok.refresh_token ?? (existing?.credentials as { refreshToken?: string } | null)?.refreshToken ?? null;

    let accountLabel: string | null = existing?.accountLabel ?? null;
    const cfg = OAUTH_PROVIDERS[key];
    if (cfg.accountLabel) {
      try { const lbl = await cfg.accountLabel(tok.access_token); if (lbl) accountLabel = lbl; } catch { /* best-effort */ }
    }

    const now = new Date();
    const credentials = {
      accessToken: tok.access_token,
      refreshToken,
      expiresAt: tok.expires_in ? new Date(now.getTime() + tok.expires_in * 1000).toISOString() : null,
    };
    await db.insert(userConnectionsTable).values({
      userId: payload.userId, provider: key, kind: cfg.kind, status: "connected",
      credentials, accountLabel, updatedAt: now,
    }).onConflictDoUpdate({
      target: [userConnectionsTable.userId, userConnectionsTable.provider],
      set: { credentials, accountLabel, status: "connected", lastError: null, updatedAt: now },
    });

    res.redirect(`${appUrl}/profile?connected=${providerParam}`);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Connect failed");
  }
});

// ── GET /me/connections/google-drive/files — browse the user's Drive ──────────
router.get("/me/connections/google-drive/files", authMiddleware, async (req, res) => {
  try {
    const token = await getValidAccessToken(req.user!.userId, "google_drive");
    const q = String(req.query.q || "").trim();
    const driveQuery = ["trashed = false", q ? `name contains '${q.replace(/'/g, "\\'")}'` : ""].filter(Boolean).join(" and ");
    const params = new URLSearchParams({
      q: driveQuery,
      pageSize: "25",
      fields: "files(id,name,mimeType,size,iconLink,modifiedTime)",
      orderBy: "modifiedTime desc",
    });
    const r = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) { res.status(502).json({ error: `Google Drive request failed (${r.status})` }); return; }
    const data = await r.json() as { files?: unknown[] };
    res.json({ files: data.files ?? [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to list Drive files";
    res.status(msg === "not_connected" ? 428 : 502).json({ error: msg });
  }
});

// Generic cloud browse for RFI attachments. Keeps the existing Google Drive
// endpoint above for compatibility while enabling Dropbox, BIM 360, and Procore.
router.get("/me/connections/:provider/browse", authMiddleware, async (req, res) => {
  const key = providerFromParam(String(req.params.provider));
  if (!key) { res.status(404).json({ error: "Unknown provider" }); return; }
  try {
    const result = await browseCloud(
      req.user!.userId,
      key,
      String(req.query.ref || ""),
      String(req.query.q || "").trim(),
    );
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to browse files";
    res.status(msg === "not_connected" ? 428 : 502).json({
      error: msg === "not_connected" ? `Connect ${OAUTH_PROVIDERS[key].label} first.` : msg,
    });
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
