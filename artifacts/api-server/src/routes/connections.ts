import { Router } from "express";
import { db } from "@workspace/db";
import { userConnectionsTable, usersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { authMiddleware, requireProjectMember, signOAuthState, verifyOAuthState } from "../middlewares/auth";
import { createHash, randomUUID } from "node:crypto";
import { buildZeroImportPreview } from "../lib/connector-crawl-preview";
import { getAppUrl } from "../lib/email";
import { browseCloud } from "../lib/cloud-files";
import { OAUTH_PROVIDERS, providerFromParam, redirectUriFor, providerConfigured, buildAuthorizeUrl, exchangeCodeForTokens, getValidAccessToken } from "../lib/oauth";
import { getAiUsageSummary, sendAiUsageError } from "../lib/ai-usage";
import {
  customerProviderCatalog,
  isProviderOperationAllowed,
  isProviderOperationCurrentlyAllowed,
} from "../lib/provider-governance";

const router: Router = Router();

// Safe projection — never leaks `credentials`.
function toSafe(c: typeof userConnectionsTable.$inferSelect) {
  const credentialMeta=(c.credentials||{}) as {expiresAt?:unknown};
  const metadata=(c.metadata||{}) as Record<string,unknown>;
  return {
    provider: c.provider,
    kind: c.kind,
    status: c.status,
    accountLabel: c.accountLabel,
    lastError: c.lastError,
    connectedAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    expiresAt: typeof credentialMeta.expiresAt === "string" ? credentialMeta.expiresAt : null,
    permissionState: typeof metadata.permissionState === "string" ? metadata.permissionState : "provider_managed",
    selectedCompanyId: typeof metadata.selectedCompanyId === "string" ? metadata.selectedCompanyId : null,
    selectedProjectId: typeof metadata.selectedProjectId === "string" ? metadata.selectedProjectId : null,
    lastSuccessfulOperationAt: typeof metadata.lastSuccessfulOperationAt === "string" ? metadata.lastSuccessfulOperationAt : null,
  };
}

// ── GET /me/connections — the current user's connected services (no secrets) ──
router.get("/me/connections", authMiddleware, async (req, res) => {
  try {
    const rows = await db.select().from(userConnectionsTable)
      .where(eq(userConnectionsTable.userId, req.user!.userId));
    res.json(rows
      .filter((row) => {
        const key = providerFromParam(row.provider);
        return !key || isProviderOperationAllowed(key, req.user!.companyId, "catalog");
      })
      .map(toSafe));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

router.get("/me/provider-catalog", authMiddleware, async (_req, res) => {
  const providers=customerProviderCatalog(_req.user!.companyId, providerConfigured);
  const procore=providers.find((provider)=>provider.key==="procore");
  if(procore){
    const approved=await isProviderOperationCurrentlyAllowed("procore",_req.user!.companyId,"catalog");
    procore.permissionState=approved?"approved":"approval_required";
    procore.availability=approved?(procore.configured?"available":"setup_required"):"review_required";
  }
  res.set("Cache-Control","private, no-store, max-age=0").json({providers});
});

router.get("/projects/:projectId/connections/procore/status",authMiddleware,requireProjectMember(),async(req,res)=>{
  const [connection]=await db.select().from(userConnectionsTable).where(and(eq(userConnectionsTable.userId,req.user!.userId),eq(userConnectionsTable.provider,"procore"))).limit(1);
  const catalog=customerProviderCatalog(req.user!.companyId,providerConfigured).find(item=>item.key==="procore");
  const approved=await isProviderOperationCurrentlyAllowed("procore",req.user!.companyId,"catalog");
  res.set("Cache-Control","private, no-store, max-age=0").json({provider:"procore",configured:providerConfigured("procore"),approved,connection:connection?toSafe(connection):null,availability:approved?(providerConfigured("procore")?"available":"setup_required"):"review_required",credentialsExposed:false});
});

router.post("/projects/:projectId/connections/procore/discovery/preview",authMiddleware,requireProjectMember(),async(req,res)=>{
  if(!await isProviderOperationCurrentlyAllowed("procore",req.user!.companyId,"browse")){res.status(403).json({code:"PROVIDER_NOT_APPROVED"});return;}
  if(req.body?.cancelled===true){res.json({state:"cancelled",pagesRead:0,recordsFound:0,canonicalMutation:false});return;}
  try{
    const result=await browseCloud(req.user!.userId,"procore",String(req.body?.ref||""),String(req.body?.query||""));
    const page={nextCursor:null,records:result.items.slice(0,100).map((item,index)=>{const descriptor=JSON.stringify({ref:item.ref,name:item.name,type:item.type,size:item.size??0,mimeType:item.mimeType??null});return {sourceId:item.ref||`record-${index+1}`,versionId:createHash("sha256").update(descriptor).digest("hex").slice(0,16),locator:item.ref,name:item.name,bytes:item.size??0,content:descriptor};})};
    const preview=buildZeroImportPreview({requestId:typeof req.body?.requestId==="string"?req.body.requestId:randomUUID(),companyId:req.user!.companyId,projectId:Number(req.params.projectId),source:"procore",sourceAccountId:"authenticated-procore-account",pages:[page]});
    res.set("Cache-Control","private, no-store, max-age=0").json({...preview,progress:{state:"complete",pagesRead:1,maximumPages:25,retryable:true},credentialsExposed:false});
  }catch(error){const message=error instanceof Error?error.message:"PROCORE_DISCOVERY_FAILED";res.status(message==="not_connected"?428:502).json({code:message==="not_connected"?"PROCORE_NOT_CONNECTED":"PROCORE_DISCOVERY_FAILED",retryable:true,canonicalMutation:false});}
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

router.post("/me/connections/sendgrid/verify", authMiddleware, async (req, res) => {
  const [connection] = await db.select().from(userConnectionsTable).where(and(eq(userConnectionsTable.userId, req.user!.userId), eq(userConnectionsTable.provider, "sendgrid"))).limit(1);
  const apiKey = (connection?.credentials as { apiKey?: unknown } | null)?.apiKey;
  if (!connection || typeof apiKey !== "string" || !apiKey || !connection.accountLabel) { res.status(428).json({ error: "Connect SendGrid before verifying the sender.", code: "SENDGRID_NOT_CONNECTED" }); return; }
  try {
    const check = await fetch("https://api.sendgrid.com/v3/verified_senders", { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!check.ok) { await db.update(userConnectionsTable).set({ status: "error", lastError: `Sender verification failed (${check.status})`, updatedAt: new Date() }).where(eq(userConnectionsTable.id, connection.id)); res.status(502).json({ error: `SendGrid sender verification failed (${check.status})`, code: "SENDGRID_VERIFICATION_FAILED" }); return; }
    const payload = await check.json() as { results?: Array<{ from_email?: string; verified?: boolean; locked?: boolean }> };
    const sender = payload.results?.find(item => item.from_email?.toLowerCase() === connection.accountLabel?.toLowerCase());
    const ready = sender?.verified === true && sender.locked !== true;
    const [updated] = await db.update(userConnectionsTable).set({ status: ready ? "ready" : "connected", lastError: ready ? null : "The configured sender is not verified in SendGrid.", metadata: { senderVerified: ready, verifiedAt: new Date().toISOString() }, updatedAt: new Date() }).where(eq(userConnectionsTable.id, connection.id)).returning();
    res.status(ready ? 200 : 409).json({ ...toSafe(updated), senderVerified: ready });
  } catch { res.status(502).json({ error: "Could not reach SendGrid to verify the sender.", code: "SENDGRID_UNAVAILABLE" }); }
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
  if (!isProviderOperationAllowed(key, req.user!.companyId, "authorize")) {
    res.status(403).json({
      error: "This connector is not approved for this company.",
      errorEs: "Este conector no está aprobado para esta empresa.",
      code: "PROVIDER_NOT_APPROVED",
    });
    return;
  }
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
    const [user] = await db.select({ companyId: usersTable.companyId }).from(usersTable)
      .where(eq(usersTable.id, payload.userId)).limit(1);
    if (!user || !isProviderOperationAllowed(key, user.companyId, "callback")) {
      return fail("This connector is not approved for this company");
    }
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
  if (!isProviderOperationAllowed("google_drive", req.user!.companyId, "browse")) {
    res.status(403).json({ error: "Provider not approved", code: "PROVIDER_NOT_APPROVED" });
    return;
  }
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
  if (!isProviderOperationAllowed(key, req.user!.companyId, "browse")) {
    res.status(403).json({
      error: "This file source is not approved for this company.",
      errorEs: "Esta fuente de archivos no está aprobada para esta empresa.",
      code: "PROVIDER_NOT_APPROVED",
    });
    return;
  }
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
    const key = providerFromParam(String(req.params.provider));
    if (key && !isProviderOperationAllowed(key, req.user!.companyId, "disconnect")) {
      res.status(403).json({ error: "Provider not approved", code: "PROVIDER_NOT_APPROVED" });
      return;
    }
    await db.delete(userConnectionsTable)
      .where(and(eq(userConnectionsTable.userId, req.user!.userId), eq(userConnectionsTable.provider, String(req.params.provider))));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

export default router;
