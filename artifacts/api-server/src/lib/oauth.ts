import { db } from "@workspace/db";
import { userConnectionsTable } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";
import { getAppUrl } from "./email";

// Per-user OAuth providers. The platform registers ONE app per provider
// (client id/secret as server env); every user then self-connects. Adding a
// provider is just a config entry here + a button in the UI.
export type OAuthProviderKey = "google_drive" | "dropbox" | "bim360" | "procore";

interface ProviderCfg {
  label: string;
  kind: string;                 // file_source | pm
  clientIdEnv: string;
  clientSecretEnv: string;
  authUrl: string;
  tokenUrl: string;
  scope: string;
  extraAuthParams?: Record<string, string>;
  tokenAuth: "body" | "basic";  // how client credentials are sent to the token endpoint
  accountLabel?: (accessToken: string) => Promise<string | null>;
}

export const OAUTH_PROVIDERS: Record<OAuthProviderKey, ProviderCfg> = {
  google_drive: {
    label: "Google Drive",
    kind: "file_source",
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/drive.readonly openid email",
    extraAuthParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
    tokenAuth: "body",
    accountLabel: async (t) => {
      const r = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${t}` } });
      if (!r.ok) return null;
      const u = await r.json() as { email?: string };
      return u.email ?? null;
    },
  },
  dropbox: {
    label: "Dropbox",
    kind: "file_source",
    clientIdEnv: "DROPBOX_CLIENT_ID",
    clientSecretEnv: "DROPBOX_CLIENT_SECRET",
    authUrl: "https://www.dropbox.com/oauth2/authorize",
    tokenUrl: "https://api.dropboxapi.com/oauth2/token",
    scope: "account_info.read files.metadata.read files.content.read",
    extraAuthParams: { token_access_type: "offline" },
    tokenAuth: "body",
    accountLabel: async (t) => {
      const r = await fetch("https://api.dropboxapi.com/2/users/get_current_account", { method: "POST", headers: { Authorization: `Bearer ${t}` } });
      if (!r.ok) return null;
      const u = await r.json() as { email?: string; name?: { display_name?: string } };
      return u.email ?? u.name?.display_name ?? null;
    },
  },
  bim360: {
    label: "BIM 360 / Autodesk",
    kind: "file_source",
    clientIdEnv: "APS_CLIENT_ID",
    clientSecretEnv: "APS_CLIENT_SECRET",
    authUrl: "https://developer.api.autodesk.com/authentication/v2/authorize",
    tokenUrl: "https://developer.api.autodesk.com/authentication/v2/token",
    scope: "data:read account:read",
    tokenAuth: "basic",
    accountLabel: async (t) => {
      const r = await fetch("https://api.userprofile.autodesk.com/userinfo", { headers: { Authorization: `Bearer ${t}` } });
      if (!r.ok) return null;
      const u = await r.json() as { email?: string; name?: string };
      return u.email ?? u.name ?? null;
    },
  },
  procore: {
    label: "Procore",
    kind: "pm",
    clientIdEnv: "PROCORE_CLIENT_ID",
    clientSecretEnv: "PROCORE_CLIENT_SECRET",
    authUrl: "https://login.procore.com/oauth/authorize",
    tokenUrl: "https://login.procore.com/oauth/token",
    scope: "",
    tokenAuth: "body",
    accountLabel: async (t) => {
      const r = await fetch("https://api.procore.com/rest/v1.0/me", { headers: { Authorization: `Bearer ${t}` } });
      if (!r.ok) return null;
      const u = await r.json() as { email?: string; login?: string };
      return u.email ?? u.login ?? null;
    },
  },
};

export function providerFromParam(p: string): OAuthProviderKey | null {
  const key = p.replace(/-/g, "_");
  return (key in OAUTH_PROVIDERS) ? (key as OAuthProviderKey) : null;
}

export const providerParam = (key: OAuthProviderKey) => key.replace(/_/g, "-");

export function redirectUriFor(param: string): string {
  return `${getAppUrl()}/api/v1/connections/${param}/callback`;
}

export function providerConfigured(key: OAuthProviderKey): boolean {
  const cfg = OAUTH_PROVIDERS[key];
  return !!process.env[cfg.clientIdEnv] && !!process.env[cfg.clientSecretEnv];
}

export function buildAuthorizeUrl(key: OAuthProviderKey, state: string, redirectUri: string): string {
  const cfg = OAUTH_PROVIDERS[key];
  const params = new URLSearchParams({
    client_id: process.env[cfg.clientIdEnv]!,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
    ...(cfg.extraAuthParams || {}),
  });
  if (cfg.scope) params.set("scope", cfg.scope);
  return `${cfg.authUrl}?${params.toString()}`;
}

interface TokenResponse { access_token?: string; refresh_token?: string; expires_in?: number }

async function callTokenEndpoint(key: OAuthProviderKey, bodyParams: Record<string, string>): Promise<TokenResponse> {
  const cfg = OAUTH_PROVIDERS[key];
  const clientId = process.env[cfg.clientIdEnv]!;
  const clientSecret = process.env[cfg.clientSecretEnv]!;
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  const body = { ...bodyParams };
  if (cfg.tokenAuth === "basic") {
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
  } else {
    body.client_id = clientId;
    body.client_secret = clientSecret;
  }
  const resp = await fetch(cfg.tokenUrl, { method: "POST", headers, body: new URLSearchParams(body).toString() });
  if (!resp.ok) throw new Error(`token endpoint failed (${resp.status})`);
  return resp.json() as Promise<TokenResponse>;
}

export function exchangeCodeForTokens(key: OAuthProviderKey, code: string, redirectUri: string): Promise<TokenResponse> {
  return callTokenEndpoint(key, { code, redirect_uri: redirectUri, grant_type: "authorization_code" });
}

// Returns a valid access token for this user+provider, refreshing if expired.
export async function getValidAccessToken(userId: number, key: OAuthProviderKey): Promise<string> {
  const [conn] = await db.select().from(userConnectionsTable)
    .where(and(eq(userConnectionsTable.userId, userId), eq(userConnectionsTable.provider, key)));
  const cred = conn?.credentials as { accessToken?: string; refreshToken?: string; expiresAt?: string | null } | null;
  if (!cred?.accessToken) throw new Error("not_connected");

  const expiresSoon = cred.expiresAt ? new Date(cred.expiresAt).getTime() < Date.now() + 60_000 : false;
  if (!expiresSoon || !cred.refreshToken) return cred.accessToken;

  const refreshed = await callTokenEndpoint(key, { grant_type: "refresh_token", refresh_token: cred.refreshToken });
  if (!refreshed.access_token) throw new Error("refresh_failed");
  const now = new Date();
  const newCred = {
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? cred.refreshToken,
    expiresAt: refreshed.expires_in ? new Date(now.getTime() + refreshed.expires_in * 1000).toISOString() : null,
  };
  await db.update(userConnectionsTable).set({ credentials: newCred, updatedAt: now }).where(eq(userConnectionsTable.id, conn!.id));
  return refreshed.access_token;
}
