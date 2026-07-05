import { Router } from "express";
import { db } from "@workspace/db";
import { userConnectionsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { authMiddleware, signOAuthState, verifyOAuthState } from "../middlewares/auth";
import { getAppUrl } from "../lib/email";

const router: Router = Router();

const GOOGLE_REDIRECT = () => `${getAppUrl()}/api/v1/connections/google-drive/callback`;

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

// ── Google Drive (OAuth) — per-user self-service connect ──────────────────────
// The platform registers ONE Google app (GOOGLE_CLIENT_ID/SECRET as server
// config); every user connects their own account through the flow below.

// Step 1: authenticated user asks for the consent URL to open.
router.get("/me/connections/google-drive/authorize", authMiddleware, (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    res.status(503).json({ error: "Google Drive is not enabled on this BIMLog yet — the platform Google app is not configured.", code: "PROVIDER_NOT_CONFIGURED" });
    return;
  }
  const state = signOAuthState(req.user!.userId, "google_drive");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: GOOGLE_REDIRECT(),
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: "https://www.googleapis.com/auth/drive.readonly openid email",
    state,
  });
  res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
});

// Step 2: Google redirects the browser back here with ?code&state (no JWT header
// — identity comes from the signed state). Exchange the code and store tokens.
router.get("/connections/google-drive/callback", async (req, res) => {
  const appUrl = getAppUrl();
  const fail = (msg: string) => res.redirect(`${appUrl}/profile?connect_error=${encodeURIComponent(msg)}`);
  try {
    const code = String(req.query.code || "");
    const state = String(req.query.state || "");
    if (!code || !state) return fail("Missing authorization code");
    let payload: { userId: number; provider: string; scope: string };
    try { payload = verifyOAuthState(state); } catch { return fail("Invalid or expired connect link"); }
    if (payload.scope !== "oauth_state" || payload.provider !== "google_drive") return fail("Invalid connect state");

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) return fail("Google app not configured");

    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: clientId, client_secret: clientSecret,
        redirect_uri: GOOGLE_REDIRECT(), grant_type: "authorization_code",
      }).toString(),
    });
    if (!tokenResp.ok) return fail("Google token exchange failed");
    const tok = await tokenResp.json() as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!tok.access_token) return fail("Google returned no access token");

    // Refresh token only comes back on first consent — keep the existing one if absent.
    let refreshToken = tok.refresh_token ?? null;
    const [existing] = await db.select().from(userConnectionsTable)
      .where(and(eq(userConnectionsTable.userId, payload.userId), eq(userConnectionsTable.provider, "google_drive")));
    if (!refreshToken) refreshToken = (existing?.credentials as { refreshToken?: string } | null)?.refreshToken ?? null;

    let accountLabel: string | null = existing?.accountLabel ?? null;
    try {
      const ui = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${tok.access_token}` } });
      if (ui.ok) { const u = await ui.json() as { email?: string }; if (u.email) accountLabel = u.email; }
    } catch { /* label is best-effort */ }

    const now = new Date();
    const credentials = {
      accessToken: tok.access_token,
      refreshToken,
      expiresAt: tok.expires_in ? new Date(now.getTime() + tok.expires_in * 1000).toISOString() : null,
    };
    await db.insert(userConnectionsTable).values({
      userId: payload.userId, provider: "google_drive", kind: "file_source", status: "connected",
      credentials, accountLabel, updatedAt: now,
    }).onConflictDoUpdate({
      target: [userConnectionsTable.userId, userConnectionsTable.provider],
      set: { credentials, accountLabel, status: "connected", lastError: null, updatedAt: now },
    });

    res.redirect(`${appUrl}/profile?connected=google-drive`);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Connect failed");
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
