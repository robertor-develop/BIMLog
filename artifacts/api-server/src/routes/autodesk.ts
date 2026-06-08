import { Router } from "express";

const router: Router = Router();

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
      scope: "bucket:create bucket:read data:read data:write data:create account:read",
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

export default router;
