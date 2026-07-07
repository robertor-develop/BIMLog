---
name: Outbound base URL config
description: How email/notification links pick their base URL, and the two-env-var gotcha
---

Outbound links in emails/invites use a base URL from env vars, with a hardcoded
fallback to the old Replit subdomain still present in source.

TWO separate env vars control this — set BOTH or links split across domains:
- `BIMLOG_URL` — used by email.ts, members.ts (invite link), auth.ts (reset link)
- `APP_URL` — used by transmittals.ts, project_directory.ts

Both are set (shared scope) to `https://bimlog.app` (custom domain, bought through
Replit, verified). Source-level fallbacks still read the old
`https://bim-log-ignite.replit.app` if the env vars are ever removed.

**Why:** custom domain bimlog.app went live 2026-07 and email links had to follow.
**How to apply:** if outbound links show the wrong domain, check that BOTH env vars
are set; changing only one leaves transmittals/directory (or email/invite/reset) on
the other value. Env var changes take effect on api-server restart (dev) and on the
next Publish (prod). autodesk.ts REDIRECT_URI now derives from APP_URL/BIMLOG_URL
(with `AUTODESK_REDIRECT_URI` as an outright override), so it follows the domain too —
currently `https://bimlog.app/api/v1/autodesk/callback`. This URL MUST be registered
verbatim in the Autodesk/APS app console or the OAuth flow fails with redirect_uri
mismatch. Keep the old replit.app callback registered alongside during any transition.
