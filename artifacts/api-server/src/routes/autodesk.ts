import { Router } from "express";
import { isLegacyAutodeskAllowed } from "../lib/provider-governance";

declare module "express-session" {
  interface SessionData {
    apsToken?: string;
    apsRefreshToken?: string;
  }
}

const router: Router = Router();

router.use((_req, res, next) => {
  if (!isLegacyAutodeskAllowed()) {
    res.status(404).json({
      error: "Connector unavailable",
      errorEs: "Conector no disponible",
      code: "PROVIDER_NOT_APPROVED",
    });
    return;
  }
  next();
});

// Must EXACTLY match a callback URL registered in the Autodesk APS app console.
// AUTODESK_REDIRECT_URI overrides it if ever needed.
const REDIRECT_URI = process.env.AUTODESK_REDIRECT_URI || "https://bimlog.app/api/v1/autodesk/callback";

router.get("/autodesk/token", async (_req, res) => {
  const clientId = process.env.APS_CLIENT_ID;
  const clientSecret = process.env.APS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    res.status(500).json({ error: "APS_CLIENT_ID and APS_CLIENT_SECRET must be set" });
    return;
  }

  try {
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      scope: "data:read data:write data:create bucket:create bucket:read",
    });

    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const response = await fetch("https://developer.api.autodesk.com/authentication/v2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basic}`,
      },
      body: body.toString(),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/autodesk/login", (_req, res) => {
  const clientId = process.env.APS_CLIENT_ID;

  if (!clientId) {
    res.status(500).json({ error: "APS_CLIENT_ID must be set" });
    return;
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    scope: "data:read data:write account:read",
    state: "bimlog",
  });

  res.redirect(`https://developer.api.autodesk.com/authentication/v2/authorize?${params.toString()}`);
});

router.get("/autodesk/callback", async (req, res) => {
  const clientId = process.env.APS_CLIENT_ID;
  const clientSecret = process.env.APS_CLIENT_SECRET;
  const code = req.query.code as string | undefined;

  if (!clientId || !clientSecret) {
    res.status(500).json({ error: "APS_CLIENT_ID and APS_CLIENT_SECRET must be set" });
    return;
  }

  if (!code) {
    res.status(400).json({ error: "Missing code parameter" });
    return;
  }

  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
    });

    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const response = await fetch("https://developer.api.autodesk.com/authentication/v2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basic}`,
      },
      body: body.toString(),
    });

    const data = await response.json() as { access_token?: unknown; refresh_token?: unknown; [key: string]: unknown };

    if (!response.ok) {
      res.status(response.status).json(data);
      return;
    }

    if (typeof data.access_token !== "string" || typeof data.refresh_token !== "string") {
      res.status(502).json({ error: "Autodesk token response was missing required token fields" });
      return;
    }

    req.session.apsToken = data.access_token;
    req.session.apsRefreshToken = data.refresh_token;

    res.redirect("/dashboard");
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/autodesk/hubs", async (req, res) => {
  const token = req.session.apsToken;

  if (!token) {
    res.redirect("/api/v1/autodesk/login");
    return;
  }

  try {
    const response = await fetch("https://developer.api.autodesk.com/project/v1/hubs", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/autodesk/projects/:hubId", async (req, res) => {
  const token = req.session.apsToken;

  if (!token) {
    res.redirect("/api/v1/autodesk/login");
    return;
  }

  try {
    const response = await fetch(
      `https://developer.api.autodesk.com/project/v1/hubs/${req.params.hubId}/projects`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
